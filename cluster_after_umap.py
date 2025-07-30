#!/usr/bin/env python3
"""
Cluster videos based on their 3D UMAP coordinates (after dimensionality reduction)
This ensures high correlation between cluster colors and spatial location
"""

import pandas as pd
import numpy as np
import pickle
import json
import os
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
from collections import Counter
import re
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import base64
from io import BytesIO

def cluster_3d_coordinates(coordinates_3d, n_clusters=10, method='kmeans'):
    """
    Cluster 3D coordinates using specified method
    """
    print(f"🎯 Clustering {len(coordinates_3d)} points using {method}...")
    
    # Standardize coordinates for better clustering
    scaler = StandardScaler()
    coords_scaled = scaler.fit_transform(coordinates_3d)
    
    if method == 'kmeans':
        # KMeans clustering - guarantees n_clusters
        clusterer = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = clusterer.fit_predict(coords_scaled)
        
    elif method == 'dbscan':
        # DBSCAN - density based, finds natural clusters
        # Adjust eps based on data distribution
        from sklearn.neighbors import NearestNeighbors
        neighbors = NearestNeighbors(n_neighbors=10)
        neighbors_fit = neighbors.fit(coords_scaled)
        distances, indices = neighbors_fit.kneighbors(coords_scaled)
        distances = np.sort(distances[:, -1])
        
        # Find elbow point for eps
        eps = np.percentile(distances, 10)  # Use 10th percentile as eps
        
        clusterer = DBSCAN(eps=eps, min_samples=5)
        cluster_labels = clusterer.fit_predict(coords_scaled)
    
    # Print clustering results
    unique_labels = set(cluster_labels)
    n_clusters_found = len(unique_labels) - (1 if -1 in unique_labels else 0)
    n_noise = list(cluster_labels).count(-1)
    
    print(f"✅ Found {n_clusters_found} clusters")
    if method == 'dbscan':
        print(f"   Noise points: {n_noise} ({n_noise/len(cluster_labels)*100:.1f}%)")
    
    return cluster_labels

def extract_keywords_from_descriptions(descriptions, stop_words=None):
    """
    Extract meaningful keywords from descriptions, excluding common words
    """
    if stop_words is None:
        # Common words to exclude
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'under', 'again',
            'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
            'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
            'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
            'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should',
            'now', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has',
            'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
            'video', 'recording', 'shows', 'showing', 'visible', 'appears',
            'seen', 'observed', 'captured'
        }
    
    # Combine all descriptions
    text = ' '.join([str(desc) for desc in descriptions if pd.notna(desc)])
    
    # Extract words
    words = re.findall(r'\b[a-z]+\b', text.lower())
    
    # Filter out stop words and short words
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 3]
    
    # Count frequencies
    word_freq = Counter(meaningful_words)
    
    return word_freq

def generate_cluster_wordcloud(cluster_videos, cluster_id):
    """
    Generate word cloud for a cluster based on video descriptions
    """
    # Combine descriptions and titles
    descriptions = []
    
    if 'description-step-by-step' in cluster_videos.columns:
        descriptions.extend(cluster_videos['description-step-by-step'].dropna().tolist())
    if 'general-description' in cluster_videos.columns:
        descriptions.extend(cluster_videos['general-description'].dropna().tolist())
    if 'video-title' in cluster_videos.columns:
        descriptions.extend(cluster_videos['video-title'].dropna().tolist())
    
    # Extract keywords
    word_freq = extract_keywords_from_descriptions(descriptions)
    
    if not word_freq:
        return None
    
    # Generate word cloud
    wordcloud = WordCloud(
        width=400,
        height=300,
        background_color='black',
        colormap='viridis',
        max_words=50,
        relative_scaling=0.5,
        min_font_size=10
    ).generate_from_frequencies(word_freq)
    
    # Convert to base64 for embedding in JSON
    plt.figure(figsize=(8, 6))
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis('off')
    plt.title(f'Cluster {cluster_id} Keywords', fontsize=16)
    
    # Save to buffer
    buffer = BytesIO()
    plt.savefig(buffer, format='png', bbox_inches='tight', facecolor='black')
    buffer.seek(0)
    wordcloud_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    
    return wordcloud_base64, dict(word_freq.most_common(20))

def create_cluster_info_with_wordclouds(df, cluster_labels, coordinates_3d):
    """
    Create comprehensive cluster information including word clouds
    """
    print("📊 Generating cluster information and word clouds...")
    
    cluster_info = {}
    unique_clusters = [c for c in set(cluster_labels) if c != -1]
    
    for cluster_id in unique_clusters:
        # Get cluster data
        cluster_mask = cluster_labels == cluster_id
        cluster_videos = df[cluster_mask].copy()
        cluster_coords = coordinates_3d[cluster_mask]
        
        if len(cluster_videos) == 0:
            continue
        
        print(f"  Processing cluster {cluster_id} ({len(cluster_videos)} videos)...")
        
        # Calculate spatial properties
        centroid = cluster_coords.mean(axis=0)
        bbox_min = cluster_coords.min(axis=0)
        bbox_max = cluster_coords.max(axis=0)
        
        # Generate word cloud
        wordcloud_b64, top_keywords = generate_cluster_wordcloud(cluster_videos, cluster_id)
        
        # Analyze metadata patterns
        main_events = cluster_videos['main-event'].value_counts().head(3)
        locations = cluster_videos['location'].value_counts().head(3)
        
        # Generate cluster label based on dominant characteristics
        if not main_events.empty:
            dominant_event = main_events.index[0].replace('-', ' ').title()
            if not locations.empty:
                dominant_location = locations.index[0].replace('-', ' ').title()
                cluster_label = f"{dominant_event} - {dominant_location}"
            else:
                cluster_label = dominant_event
        else:
            cluster_label = f"Cluster {cluster_id}"
        
        # Calculate cluster statistics
        anomaly_scores = cluster_videos['anomaly_score'] if 'anomaly_score' in cluster_videos.columns else pd.Series([0])
        
        cluster_info[int(cluster_id)] = {
            'cluster_id': int(cluster_id),
            'label': cluster_label,
            'size': int(len(cluster_videos)),
            'centroid': centroid.tolist(),
            'bounding_box': {
                'min': bbox_min.tolist(),
                'max': bbox_max.tolist()
            },
            'spatial_spread': float(np.std(cluster_coords)),
            'statistics': {
                'avg_anomaly_score': float(anomaly_scores.mean()),
                'high_anomaly_count': int((anomaly_scores > 0.5).sum()),
                'main_events': {str(k): int(v) for k, v in main_events.items()},
                'locations': {str(k): int(v) for k, v in locations.items()}
            },
            'wordcloud_base64': wordcloud_b64,
            'top_keywords': top_keywords,
            'sample_videos': cluster_videos.head(5)[['video_id', 'video-title']].to_dict('records')
        }
    
    print(f"✅ Generated info for {len(cluster_info)} clusters")
    return cluster_info

def update_dataset_with_new_clusters(df, cluster_labels):
    """
    Update the dataset with new cluster assignments
    """
    df['cluster_id'] = cluster_labels
    
    # Calculate distances to cluster centroids for each point
    coordinates = df[['x', 'y', 'z']].values
    
    # Add cluster confidence (inverse of distance to centroid)
    cluster_distances = []
    for i, (idx, row) in enumerate(df.iterrows()):
        if row['cluster_id'] != -1:
            cluster_mask = df['cluster_id'] == row['cluster_id']
            centroid = df[cluster_mask][['x', 'y', 'z']].mean().values
            distance = np.linalg.norm(coordinates[i] - centroid)
            cluster_distances.append(distance)
        else:
            cluster_distances.append(np.nan)
    
    df['cluster_distance'] = cluster_distances
    
    return df

def main():
    """
    Main function to perform clustering on 3D coordinates
    """
    print("🚀 Starting 3D coordinate clustering...")
    
    # Load current dataset
    df = pd.read_csv('data/df_gemini.csv')
    print(f"📹 Loaded {len(df)} videos")
    
    # Extract 3D coordinates
    if all(col in df.columns for col in ['x', 'y', 'z']):
        coordinates_3d = df[['x', 'y', 'z']].values
    else:
        # Load from processed file
        coordinates_3d = np.load('data/processed/coordinates_3d.npy')
    
    print(f"📍 Using {len(coordinates_3d)} 3D coordinates")
    
    # Perform clustering
    cluster_labels = cluster_3d_coordinates(
        coordinates_3d, 
        n_clusters=10,  # Adjust based on your needs
        method='kmeans'  # or 'dbscan'
    )
    
    # Update dataset with new clusters
    df = update_dataset_with_new_clusters(df, cluster_labels)
    
    # Generate cluster information with word clouds
    cluster_info = create_cluster_info_with_wordclouds(df, cluster_labels, coordinates_3d)
    
    # Save results
    print("💾 Saving results...")
    
    # Save updated dataset
    df.to_csv('data/df_gemini.csv', index=False)
    
    # Save cluster info
    with open('data/cluster_info.json', 'w') as f:
        json.dump(cluster_info, f, indent=2)
    
    # Save just the cluster assignments for quick loading
    np.save('data/cluster_labels.npy', cluster_labels)
    
    # Update processed coordinates
    os.makedirs('data/processed', exist_ok=True)
    np.save('data/processed/coordinates_3d.npy', coordinates_3d)
    
    print("🎉 Clustering complete!")
    print(f"   Total clusters: {len(cluster_info)}")
    print(f"   Noise points: {(cluster_labels == -1).sum()}")
    
    # Print cluster summary
    print("\n📊 Cluster Summary:")
    for cid, info in cluster_info.items():
        print(f"   Cluster {cid}: {info['label']} ({info['size']} videos)")

if __name__ == '__main__':
    # Check if wordcloud is installed
    try:
        import wordcloud
    except ImportError:
        print("⚠️  Installing wordcloud library...")
        import subprocess
        subprocess.check_call(['pip', 'install', 'wordcloud'])
    
    main()