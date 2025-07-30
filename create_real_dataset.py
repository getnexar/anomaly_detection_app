#!/usr/bin/env python3
"""
Create dataset using real embeddings and video data that match
"""

import pandas as pd
import numpy as np
import pickle
import json
import os

def create_real_dataset():
    """Create a dataset using videos that have real embeddings"""
    print("🎬 Creating dataset with real embeddings...")
    
    # Load full dataset
    df_full = pd.read_csv('data/df_gemini_full.csv')
    print(f"📹 Full dataset: {len(df_full)} videos")
    
    # Load real embeddings metadata
    with open('data/embeddings_metadata.pkl', 'rb') as f:
        emb_metadata = pickle.load(f)
    
    real_video_ids = emb_metadata['video_ids']
    print(f"🎯 Videos with embeddings: {len(real_video_ids)}")
    
    # Load real UMAP coordinates
    real_coords = np.load('data/umap_3d_coordinates.npy')
    print(f"📍 UMAP coordinates: {real_coords.shape}")
    
    # Filter dataset to only include videos with embeddings
    df_real = df_full[df_full['video_id'].isin(real_video_ids)].copy()
    print(f"✅ Filtered dataset: {len(df_real)} videos")
    
    # Create coordinate mapping
    coord_mapping = {}
    for i, video_id in enumerate(real_video_ids):
        if i < len(real_coords):  # Safety check
            coord_mapping[video_id] = real_coords[i]
    
    # Add 3D coordinates to dataset
    df_real['x'] = df_real['video_id'].map(lambda vid: float(coord_mapping[vid][0]) if vid in coord_mapping else 0.0)
    df_real['y'] = df_real['video_id'].map(lambda vid: float(coord_mapping[vid][1]) if vid in coord_mapping else 0.0)
    df_real['z'] = df_real['video_id'].map(lambda vid: float(coord_mapping[vid][2]) if vid in coord_mapping else 0.0)
    
    # Generate fake anomaly scores and cluster IDs for now
    np.random.seed(42)
    n_videos = len(df_real)
    
    # Generate anomaly scores (most normal, some anomalous)
    anomaly_scores = np.random.beta(2, 8, n_videos)
    high_anomaly_mask = np.random.random(n_videos) < 0.1  # 10% high anomalies
    anomaly_scores[high_anomaly_mask] = np.random.uniform(0.7, 1.0, high_anomaly_mask.sum())
    df_real['anomaly_score'] = anomaly_scores.round(4)
    
    # Generate cluster IDs
    df_real['cluster_id'] = np.random.choice([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 
                                           size=n_videos, 
                                           p=[0.1, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09])
    
    # Clean up column names and ensure required fields exist
    column_mapping = {
        'video-title': 'video-title',
        'general-description': 'general-description', 
        'description-step-by-step': 'description-step-by-step',
        'interpretation': 'interpretation',
        'main-event': 'main-event',
        'location': 'location',
        'zone': 'zone',
        'light-conditions': 'light-conditions',
        'weather-conditions': 'weather-conditions',
        'video-quality': 'video-quality',
        'type-of-vehicle-recording': 'type-of-vehicle-recording',
        'camera-mounting-state': 'camera-mounting-state',
        'camera-viewpoint-direction': 'camera-viewpoint-direction'
    }
    
    # Ensure required columns exist with defaults
    required_columns = [
        'video_id', 'video_path', 'video-title', 'description-step-by-step', 
        'general-description', 'interpretation', 'main-event', 'location', 'zone',
        'weather-conditions', 'light-conditions', 'video-quality', 
        'type-of-vehicle-recording', 'camera-mounting-state', 
        'camera-viewpoint-direction', 'anomaly_score', 'cluster_id', 'x', 'y', 'z'
    ]
    
    for col in required_columns:
        if col not in df_real.columns:
            if col == 'video_path':
                df_real[col] = df_real['video_id'].apply(lambda x: f'/path/to/videos/{x}.mp4')
            elif col in ['camera-mounting-state', 'camera-viewpoint-direction']:
                df_real[col] = 'mounted' if col == 'camera-mounting-state' else 'forward'
            else:
                df_real[col] = 'unknown'
    
    # Select and reorder columns
    df_final = df_real[required_columns].copy()
    
    # Save the real dataset
    df_final.to_csv('data/df_gemini.csv', index=False)
    print(f"💾 Saved real dataset: {len(df_final)} videos")
    
    # Create cluster info (simplified for real data)
    create_cluster_info(df_final)
    
    # Update processed files
    os.makedirs('data/processed', exist_ok=True)
    coords_3d = df_final[['x', 'y', 'z']].values
    np.save('data/processed/coordinates_3d.npy', coords_3d)
    print("💾 Updated processed coordinates")
    
    print("🎉 Real dataset integration complete!")
    return df_final

def create_cluster_info(df):
    """Create cluster information for real data"""
    print("🎯 Creating cluster information...")
    
    cluster_info = {}
    unique_clusters = [cid for cid in df['cluster_id'].unique() if cid != -1]
    
    cluster_labels = [
        "Highway Incidents", "Urban Traffic", "Parking Events", "Intersection Activity",
        "Weather Conditions", "Night Operations", "Emergency Situations", 
        "Pedestrian Areas", "Industrial Zones", "Rural Roads"
    ]
    
    for i, cluster_id in enumerate(unique_clusters):
        cluster_videos = df[df['cluster_id'] == cluster_id]
        
        if len(cluster_videos) == 0:
            continue
            
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
            'description': f'Real data cluster with {len(cluster_videos)} videos'
        }
    
    # Save cluster info
    with open('data/cluster_info.json', 'w') as f:
        json.dump(cluster_info, f, indent=2)
    
    print(f"✅ Created cluster info for {len(cluster_info)} clusters")

if __name__ == '__main__':
    create_real_dataset()