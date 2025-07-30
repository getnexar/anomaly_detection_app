#!/usr/bin/env python3
"""
Integrate real embeddings and UMAP coordinates into the system
"""

import pandas as pd
import numpy as np
import pickle
import json
import os

def integrate_real_embeddings():
    """Integrate real embeddings and coordinates with existing video data"""
    print("🔗 Integrating real embeddings and UMAP coordinates...")
    
    # Load current video data
    df = pd.read_csv('data/df_gemini.csv')
    print(f"📹 Current video data: {len(df)} videos")
    
    # Load real UMAP coordinates
    real_coords = np.load('data/umap_3d_coordinates.npy')
    print(f"🎯 Real UMAP coordinates: {real_coords.shape}")
    
    # Load UMAP metadata to get video IDs
    with open('data/umap_3d_metadata.pkl', 'rb') as f:
        umap_metadata = pickle.load(f)
    
    real_video_ids = umap_metadata['video_ids']
    print(f"📋 Real video IDs: {len(real_video_ids)}")
    
    # Create mapping of real coordinates to video IDs
    coord_mapping = {}
    for i, video_id in enumerate(real_video_ids):
        coord_mapping[video_id] = real_coords[i]
    
    # Update coordinates for videos that have real embeddings
    updated_count = 0
    for idx, row in df.iterrows():
        video_id = row['video_id']
        if video_id in coord_mapping:
            # Update with real coordinates
            df.at[idx, 'x'] = float(coord_mapping[video_id][0])
            df.at[idx, 'y'] = float(coord_mapping[video_id][1]) 
            df.at[idx, 'z'] = float(coord_mapping[video_id][2])
            updated_count += 1
    
    print(f"✅ Updated {updated_count} videos with real UMAP coordinates")
    
    # Save updated CSV
    df.to_csv('data/df_gemini.csv', index=False)
    print("💾 Saved updated video data")
    
    # Update processed coordinates file
    os.makedirs('data/processed', exist_ok=True)
    np.save('data/processed/coordinates_3d.npy', df[['x', 'y', 'z']].values)
    print("💾 Updated processed coordinates file")
    
    return df

if __name__ == '__main__':
    integrate_real_embeddings()