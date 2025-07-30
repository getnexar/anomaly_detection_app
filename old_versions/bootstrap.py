#!/usr/bin/env python3
"""
Bootstrap script to create minimal working data for the video analysis app
This generates fake data so the app can run end-to-end without real embeddings/clustering
"""

import pandas as pd
import numpy as np
import json
import os
from pathlib import Path

def create_sample_data():
    """Create sample video data with fake coordinates and metadata"""
    print("🎬 Creating sample video data...")
    
    # Generate sample video metadata
    np.random.seed(42)  # For reproducible results
    
    n_videos = 1000  # Start with 1000 videos for testing
    
    # Sample data categories
    main_events = ['normal-driving', 'accident', 'abrupt-overtaking', 'pedestrian-crossing', 'traffic-jam', 'parking']
    locations = ['highway', 'city-street', 'parking-lot', 'intersection', 'residential', 'tunnel']
    zones = ['urban', 'suburban', 'rural', 'industrial']
    weather_conditions = ['clear', 'rainy', 'foggy', 'snowy', 'cloudy']
    light_conditions = ['daylight', 'dusk', 'night', 'dawn']
    video_qualities = ['high', 'medium', 'low']
    
    # Generate sample data
    data = []
    for i in range(n_videos):
        video_id = f"video_{i:06d}"
        
        # Generate fake coordinates (3D space)
        x = np.random.normal(0, 15)
        y = np.random.normal(0, 15) 
        z = np.random.normal(0, 15)
        
        # Generate anomaly score (most videos normal, some anomalous)
        anomaly_score = np.random.beta(2, 8)  # Skewed towards low values
        if np.random.random() < 0.1:  # 10% high anomalies
            anomaly_score = np.random.uniform(0.7, 1.0)
        
        # Generate cluster ID (some unclustered)
        cluster_id = np.random.choice([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], p=[0.1, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09])
        
        # Generate realistic descriptions
        main_event = np.random.choice(main_events)
        
        if main_event == 'accident':
            description = f"Vehicle collision observed at intersection. Multiple vehicles involved with emergency response."
            interpretation = "High-risk traffic incident requiring immediate attention"
        elif main_event == 'abrupt-overtaking':
            description = f"Vehicle performing sudden lane change without proper signaling on highway."
            interpretation = "Aggressive driving behavior detected"
        elif main_event == 'pedestrian-crossing':
            description = f"Pedestrians crossing street at designated crosswalk during traffic."
            interpretation = "Normal pedestrian activity observed"
        else:
            description = f"Regular traffic flow with {main_event} behavior patterns."
            interpretation = "Standard driving conditions observed"
        
        video_data = {
            'video_id': video_id,
            'video_path': f'/fake/path/videos/{video_id}.mp4',
            'video-title': f'{main_event.replace("-", " ").title()} - {video_id}',
            'description-step-by-step': description,
            'general-description': description,
            'interpretation': interpretation,
            'main-event': main_event,
            'location': np.random.choice(locations),
            'zone': np.random.choice(zones),
            'weather-conditions': np.random.choice(weather_conditions),  
            'light-conditions': np.random.choice(light_conditions),
            'video-quality': np.random.choice(video_qualities),
            'type-of-vehicle-recording': 'dashcam',
            'camera-mounting-state': 'mounted',
            'camera-viewpoint-direction': 'forward',
            'anomaly_score': round(anomaly_score, 4),
            'cluster_id': cluster_id,
            # Fake 3D coordinates
            'x': round(x, 4),
            'y': round(y, 4), 
            'z': round(z, 4)
        }
        
        data.append(video_data)
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Save to CSV
    output_path = 'data/df_gemini.csv'
    os.makedirs('data', exist_ok=True)
    df.to_csv(output_path, index=False)
    
    print(f"✅ Created {len(df)} sample videos in {output_path}")
    return df

def create_fake_cluster_info(df):
    """Create fake cluster information"""
    print("🎯 Creating cluster information...")
    
    cluster_info = {}
    
    # Get unique cluster IDs (excluding -1 for unclustered)
    cluster_ids = [cid for cid in df['cluster_id'].unique() if cid != -1]
    
    cluster_labels = [
        "Highway Driving",
        "City Traffic", 
        "Parking Maneuvers",
        "Intersection Events",
        "Weather Incidents",
        "Night Driving",
        "Emergency Situations",
        "Pedestrian Areas",
        "Construction Zones",
        "Rural Roads"
    ]
    
    for i, cluster_id in enumerate(cluster_ids):
        cluster_videos = df[df['cluster_id'] == cluster_id]
        
        # Calculate centroid
        centroid = [
            float(cluster_videos['x'].mean()),
            float(cluster_videos['y'].mean()),
            float(cluster_videos['z'].mean())
        ]
        
        # Get common keywords from main events
        keywords = list(cluster_videos['main-event'].value_counts().head(3).index)
        
        cluster_info[str(cluster_id)] = {
            'label': cluster_labels[i] if i < len(cluster_labels) else f'Cluster {cluster_id}',
            'size': len(cluster_videos),
            'centroid': centroid,
            'keywords': keywords,
            'description': f'Cluster containing {len(cluster_videos)} videos with similar patterns'
        }
    
    # Save cluster info
    with open('data/cluster_info.json', 'w') as f:
        json.dump(cluster_info, f, indent=2)
    
    print(f"✅ Created cluster info for {len(cluster_info)} clusters")
    return cluster_info

def create_minimal_flask_data():
    """Create minimal data files that Flask can load without ML dependencies"""
    print("🏭 Creating minimal Flask data...")
    
    # Create basic embeddings placeholder (we won't actually use these)
    os.makedirs('data/processed', exist_ok=True)
    
    # Create empty placeholder files
    with open('data/processed/embeddings.npy', 'wb') as f:
        np.save(f, np.random.random((1000, 100)))  # Fake embeddings
        
    with open('data/processed/coordinates_3d.npy', 'wb') as f:
        # Load the coordinates we created
        df = pd.read_csv('data/df_gemini.csv')
        coords = df[['x', 'y', 'z']].values
        np.save(f, coords)
    
    print("✅ Created minimal data files")

def update_flask_app_for_bootstrap():
    """Update Flask app to work with bootstrap data"""
    print("🔧 Updating Flask app configuration...")
    
    # Create simplified initialization function
    bootstrap_init = '''
def bootstrap_initialize_app():
    """Bootstrap initialization with minimal dependencies"""
    global video_data, coordinates_3d, cluster_info
    
    try:
        print("📊 Loading bootstrap data...")
        
        # Load video data
        if os.path.exists('data/df_gemini.csv'):
            video_data = pd.read_csv('data/df_gemini.csv')
            print(f"✅ Loaded {len(video_data)} videos")
            
            # Add coordinates from CSV
            if 'x' in video_data.columns:
                coordinates_3d = video_data[['x', 'y', 'z']].values
                print(f"✅ Loaded 3D coordinates for {len(coordinates_3d)} videos")
        
        # Load cluster info
        if os.path.exists('data/cluster_info.json'):
            with open('data/cluster_info.json', 'r') as f:
                cluster_info = json.load(f)
                print(f"✅ Loaded {len(cluster_info)} clusters")
        
        print("🎉 Bootstrap initialization complete!")
        
    except Exception as e:
        print(f"❌ Bootstrap initialization failed: {e}")
        # Set minimal defaults
        video_data = pd.DataFrame()
        coordinates_3d = None
        cluster_info = {}

# Replace the original initialize_app in bootstrap mode
if __name__ == '__main__':
    bootstrap_initialize_app()
'''
    
    # Read the current Flask app
    with open('backend/app.py', 'r') as f:
        app_content = f.read()
    
    # Add bootstrap function before the main execution
    app_content = app_content.replace(
        'if __name__ == \'__main__\':',
        bootstrap_init + '\nif __name__ == \'__main__\':'
    )
    
    # Replace the initialize_app call with bootstrap version
    app_content = app_content.replace(
        'initialize_app()',
        'bootstrap_initialize_app()'
    )
    
    # Write back
    with open('backend/app.py', 'w') as f:
        f.write(app_content)
    
    print("✅ Updated Flask app for bootstrap mode")

def main():
    """Main bootstrap function"""
    print("🚀 Starting Video Analysis App Bootstrap...")
    print("=" * 50)
    
    # Create sample data 
    df = create_sample_data()
    
    # Create cluster info
    create_fake_cluster_info(df)
    
    # Create minimal files for Flask
    create_minimal_flask_data()
    
    # Update Flask app
    update_flask_app_for_bootstrap()
    
    print("=" * 50)
    print("🎉 Bootstrap complete!")
    print("")
    print("📋 Next steps:")
    print("1. pip install -r requirements.txt")  
    print("2. python backend/app.py")
    print("3. Open http://localhost:5000 in your browser")
    print("")
    print("📹 The app will work with 1000 sample videos")
    print("🎯 You can click on points to see details (videos won't play)")
    print("🔍 Search and filtering will work with sample data")

if __name__ == '__main__':
    main()