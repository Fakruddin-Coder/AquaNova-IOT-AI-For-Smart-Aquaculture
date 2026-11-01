import os
import random
import datetime
import pandas as pd
from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from typing import Optional

app = FastAPI(title="AquaNova ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/aquanova")
client = MongoClient(MONGO_URI)
db = client.get_database()
readings_col = db.get_collection("sensorreadings")

last_compute_time = None
last_compute_args = None
cached_result = None

def get_latest_data(limit=1000):
    cursor = readings_col.find().sort("timestamp", -1).limit(limit)
    data = list(cursor)
    if not data:
        return pd.DataFrame()
    
    flat_data = []
    for d in data:
        flat = {
            "timestamp": d.get("timestamp", datetime.datetime.now()),
            "temperature": d.get("temperature", 25),
            "ph": d.get("ph", 7.0),
            "waterLevel": d.get("waterLevel", 90)
        }
        other = d.get("otherSensorValues", {})
        flat["dissolvedOxygen"] = other.get("dissolvedOxygen", 7.0)
        flat["turbidity"] = other.get("turbidity", 5.0)
        flat["ammonia"] = other.get("ammonia", 0.1)
        flat_data.append(flat)
        
    df = pd.DataFrame(flat_data)
    df.set_index("timestamp", inplace=True)
    df = df.sort_index()
    return df

def compute_ml_data(temp=None, ph=None, do=None, turb=None, level=None):
    global last_compute_time, last_compute_args, cached_result
    
    args = (temp, ph, do, turb, level)
    now = datetime.datetime.now()
    if cached_result and last_compute_args == args and last_compute_time and (now - last_compute_time).total_seconds() < 2:
        return cached_result

    print(f"[ML] Computing ML data... (Live args: {args})")
    df = get_latest_data()
    
    if temp is not None:
        latest_override = {
            "temperature": float(temp),
            "ph": float(ph) if ph is not None else 7.0,
            "dissolvedOxygen": float(do) if do is not None else 7.0,
            "turbidity": float(turb) if turb is not None else 5.0,
            "waterLevel": float(level) if level is not None else 90.0,
            "ammonia": 0.1 # mock
        }
        if not df.empty:
            latest_override["timestamp"] = now
            df.loc[latest_override["timestamp"]] = latest_override
        else:
            df = pd.DataFrame([latest_override])
            df["timestamp"] = now
            df.set_index("timestamp", inplace=True)
            
    if df.empty:
        return {
            "health": {"score": 0, "label": "Unknown", "factors": {}},
            "predictions": [],
            "anomalies": [],
            "recommendations": []
        }

    latest = df.iloc[-1]
    
    # 1. Health Score
    score = 100
    factors = {"temperature": 1.0, "ph": 1.0, "dissolvedOxygen": 1.0, "ammonia": 1.0}
    
    if not (24 <= latest["temperature"] <= 30):
        score -= 15
        factors["temperature"] = 0.5
    if not (6.5 <= latest["ph"] <= 8.5):
        score -= 20
        factors["ph"] = 0.4
    if latest["dissolvedOxygen"] < 5:
        score -= 25
        factors["dissolvedOxygen"] = 0.3
    if latest.get("ammonia", 0) > 0.5:
        score -= 30
        factors["ammonia"] = 0.2
        
    label = "Excellent" if score >= 80 else ("Good" if score >= 60 else "Needs Attention")
    health = {"score": max(0, score), "label": label, "factors": factors}
    
    # 2. Predictions
    predictions = []
    for param in ["temperature", "ph", "dissolvedOxygen", "turbidity"]:
        try:
            series = df[param].resample('1h').mean().ffill()
            if len(series) > 24:
                model = ExponentialSmoothing(series, trend='add', seasonal=None, initialization_method="estimated").fit()
                forecast = model.forecast(6)
                pred_value = forecast.iloc[-1]
                trend_val = pred_value - series.iloc[-1]
                
                predictions.append({
                    "id": f"pred-{param}",
                    "model_type": f"{param}_forecast",
                    "predicted_value": float(pred_value),
                    "factors": {"confidence": 0.85, "trend": float(trend_val/6)},
                    "created_at": now.isoformat()
                })
        except Exception as e:
            pass
            
    # 3. Anomalies
    anomalies = []
    try:
        iso_df = df.dropna()
        if len(iso_df) > 50:
            clf = IsolationForest(contamination=0.02, random_state=42)
            preds = clf.fit_predict(iso_df)
            if preds[-1] == -1:
                anomalies.append({
                    "id": "anom-iso-1", "source": "sensor", "severity": "critical",
                    "description": "Multi-variate anomaly detected in recent readings.",
                    "detected_at": now.isoformat()
                })
    except:
        pass
        
    if latest["dissolvedOxygen"] < 4:
        anomalies.append({
            "id": "anom-do", "source": "sensor", "severity": "critical",
            "description": f"Critical DO drop detected: {latest['dissolvedOxygen']:.1f} mg/L",
            "detected_at": now.isoformat()
        })
        
    # 4. Recommendations
    recs = []
    if latest["dissolvedOxygen"] < 5:
        recs.append({"id": "rec-1", "level": "warning", "message": "Oxygen predicted to drop, increase aeration.", "created_at": now.isoformat()})
    if latest.get("ammonia", 0) > 0.3:
        recs.append({"id": "rec-2", "level": "warning", "message": "High ammonia trend. Consider 10% water exchange.", "created_at": now.isoformat()})
    if not recs:
        recs.append({"id": "rec-ok", "level": "healthy", "message": "All parameters optimal. Maintain current schedule.", "created_at": now.isoformat()})

    res = {
        "health": health,
        "predictions": predictions,
        "anomalies": anomalies,
        "recommendations": recs
    }
    
    cached_result = res
    last_compute_args = args
    last_compute_time = now
    return res

def parse_params(temperature, ph, dissolvedOxygen, turbidity, waterLevel):
    return (temperature, ph, dissolvedOxygen, turbidity, waterLevel)

@app.get("/api/ml/health")
def get_health(temperature: Optional[float] = None, ph: Optional[float] = None, dissolvedOxygen: Optional[float] = None, turbidity: Optional[float] = None, waterLevel: Optional[float] = None):
    data = compute_ml_data(*parse_params(temperature, ph, dissolvedOxygen, turbidity, waterLevel))
    return data["health"]

@app.get("/api/ml/predict")
def get_predict(temperature: Optional[float] = None, ph: Optional[float] = None, dissolvedOxygen: Optional[float] = None, turbidity: Optional[float] = None, waterLevel: Optional[float] = None):
    data = compute_ml_data(*parse_params(temperature, ph, dissolvedOxygen, turbidity, waterLevel))
    return data["predictions"]

@app.get("/api/ml/anomalies")
def get_anomalies(temperature: Optional[float] = None, ph: Optional[float] = None, dissolvedOxygen: Optional[float] = None, turbidity: Optional[float] = None, waterLevel: Optional[float] = None):
    data = compute_ml_data(*parse_params(temperature, ph, dissolvedOxygen, turbidity, waterLevel))
    return data["anomalies"]

@app.get("/api/ml/recommendations")
def get_recommendations(temperature: Optional[float] = None, ph: Optional[float] = None, dissolvedOxygen: Optional[float] = None, turbidity: Optional[float] = None, waterLevel: Optional[float] = None):
    data = compute_ml_data(*parse_params(temperature, ph, dissolvedOxygen, turbidity, waterLevel))
    return data["recommendations"]

@app.get("/api/ml/camera")
def get_camera():
    activity_levels = ["Resting", "Normal", "Active", "Highly Active"]
    feeding = ["Normal", "Aggressive", "Slow", "Ignore"]
    movement = ["Schooling", "Lively swimming patterns", "Erratic", "Lethargic"]
    
    return {
        "fish_activity": random.choice(activity_levels),
        "feeding_activity": random.choice(feeding),
        "fish_movement": random.choice(movement),
        "tank_visibility": f"Clear ({random.randint(85, 100)}%)",
        "dead_fish_detected": random.random() < 0.01,
        "summary": "Simulated YOLOv8 analysis: Aquatic fauna behaving normally.",
        "analyzed_at": datetime.datetime.now().isoformat()
    }
