#!/usr/bin/env python3
"""
Hierarchical clustering with two stages:
1. First level: Main clusters using HDBSCAN
2. Second level: Sub-clusters within each main cluster
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import HDBSCAN, DBSCAN
from collections import Counter
import json
import numpy as np
import re
from wordcloud import WordCloud
import base64
from io import BytesIO
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

def hierarchical_cluster_3d(coordinates_3d, min_cluster_size=10, min_samples=5):
    """
    Perform two-stage hierarchical clustering on 3D coordinates
    """
    # Stage 1: Main clusters using HDBSCAN
    print("\n🔍 Stage 1: Finding main clusters...")
    scaler = StandardScaler()
    coords_scaled = scaler.fit_transform(coordinates_3d)
    
    # HDBSCAN for adaptive clustering
    clusterer_stage1 = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_epsilon=0.5,
        metric='euclidean'
    )
    
    main_clusters = clusterer_stage1.fit_predict(coords_scaled)
    n_main_clusters = len(set(main_clusters)) - (1 if -1 in main_clusters else 0)
    n_noise_main = list(main_clusters).count(-1)
    
    print(f"✅ Found {n_main_clusters} main clusters")
    print(f"   Noise points: {n_noise_main} ({n_noise_main/len(main_clusters)*100:.1f}%)")
    
    # Stage 2: Sub-clusters within each main cluster
    print("\n🔍 Stage 2: Finding sub-clusters within main clusters...")
    sub_clusters = np.copy(main_clusters)
    sub_cluster_offset = 1000  # To differentiate sub-clusters across main clusters
    
    cluster_hierarchy = {}
    
    for main_cluster_id in range(n_main_clusters):
        mask = main_clusters == main_cluster_id
        if np.sum(mask) < 10:  # Skip small clusters
            continue
            
        cluster_coords = coords_scaled[mask]
        
        # Use DBSCAN for sub-clustering with adaptive eps
        # Calculate eps based on nearest neighbor distances
        from sklearn.neighbors import NearestNeighbors
        neighbors = NearestNeighbors(n_neighbors=min(5, len(cluster_coords)))
        neighbors_fit = neighbors.fit(cluster_coords)
        distances, indices = neighbors_fit.kneighbors(cluster_coords)
        distances = np.sort(distances[:, -1])
        eps = np.percentile(distances, 20)  # Use 20th percentile as eps
        
        sub_clusterer = DBSCAN(eps=eps, min_samples=3)
        sub_labels = sub_clusterer.fit_predict(cluster_coords)
        
        # Update sub_clusters array
        sub_cluster_ids = np.where(mask)[0]
        for i, sub_label in enumerate(sub_labels):
            if sub_label != -1:
                sub_clusters[sub_cluster_ids[i]] = main_cluster_id * sub_cluster_offset + sub_label
        
        n_sub = len(set(sub_labels)) - (1 if -1 in sub_labels else 0)
        cluster_hierarchy[main_cluster_id] = {
            'n_subclusters': int(n_sub),
            'size': int(np.sum(mask)),
            'subclusters': [int(x) for x in set(sub_labels) - {-1}]
        }
        
        print(f"   Main cluster {main_cluster_id}: {n_sub} sub-clusters from {np.sum(mask)} points")
    
    return main_clusters, sub_clusters, cluster_hierarchy

def extract_keywords_from_descriptions(descriptions, stop_words=None):
    """Extract meaningful keywords from descriptions, excluding common words"""
    if stop_words is None:
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
    
    text = ' '.join([str(desc) for desc in descriptions if pd.notna(desc)])
    words = re.findall(r'\b[a-z]+\b', text.lower())
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 3]
    word_freq = Counter(meaningful_words)
    
    return word_freq

def generate_cluster_wordcloud(cluster_videos, cluster_id, is_subcluster=False):
    """Generate word cloud for a cluster based on video descriptions"""
    # Use available description columns
    descriptions = []
    if 'general-description' in cluster_videos.columns:
        descriptions.extend(cluster_videos['general-description'].tolist())
    if 'description-step-by-step' in cluster_videos.columns:
        descriptions.extend(cluster_videos['description-step-by-step'].tolist())
    word_freq = extract_keywords_from_descriptions(descriptions)
    
    if not word_freq:
        return None, {}
    
    # Generate word cloud
    wordcloud = WordCloud(
        width=400,
        height=200,
        background_color='black',
        colormap='plasma' if is_subcluster else 'viridis',
        max_words=50,
        relative_scaling=0.5,
        min_font_size=10
    ).generate_from_frequencies(word_freq)
    
    # Convert to base64
    buffer = BytesIO()
    plt.figure(figsize=(8, 4))
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis('off')
    plt.tight_layout(pad=0)
    plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight', 
                facecolor='black', edgecolor='none')
    plt.close()
    
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
    
    return image_base64, dict(word_freq.most_common(20))

def main():
    print("🚀 Starting hierarchical clustering...")
    
    # Load data
    df = pd.read_csv('data/df_gemini.csv')
    print(f"📊 Loaded {len(df)} videos")
    
    # Extract 3D coordinates
    coordinates_3d = df[['x', 'y', 'z']].values
    
    # Perform hierarchical clustering
    main_clusters, sub_clusters, hierarchy = hierarchical_cluster_3d(
        coordinates_3d,
        min_cluster_size=15,
        min_samples=5
    )
    
    # Update dataframe
    df['main_cluster_id'] = main_clusters
    df['sub_cluster_id'] = sub_clusters
    
    # Generate cluster information
    cluster_info = {
        'main_clusters': {},
        'sub_clusters': {},
        'hierarchy': hierarchy
    }
    
    # Process main clusters
    print("\n📊 Generating word clouds for main clusters...")
    unique_main_clusters = [c for c in np.unique(main_clusters) if c != -1]
    
    for cluster_id in unique_main_clusters:
        cluster_mask = df['main_cluster_id'] == cluster_id
        cluster_videos = df[cluster_mask]
        
        if len(cluster_videos) > 0:
            wordcloud_base64, top_keywords = generate_cluster_wordcloud(cluster_videos, cluster_id)
            
            # Calculate cluster statistics
            cluster_info['main_clusters'][int(cluster_id)] = {
                'cluster_id': int(cluster_id),
                'label': f'Main Cluster {cluster_id}',
                'size': len(cluster_videos),
                'wordcloud_base64': wordcloud_base64,
                'top_keywords': top_keywords,
                'statistics': {
                    'avg_anomaly_score': float(cluster_videos['anomaly_score'].mean()),
                    'std_anomaly_score': float(cluster_videos['anomaly_score'].std()),
                    'high_anomaly_count': int((cluster_videos['anomaly_score'] > 0.7).sum())
                },
                'centroid': {
                    'x': float(cluster_videos['x'].mean()),
                    'y': float(cluster_videos['y'].mean()),
                    'z': float(cluster_videos['z'].mean())
                }
            }
    
    # Process sub-clusters
    print("\n📊 Generating word clouds for sub-clusters...")
    unique_sub_clusters = [c for c in np.unique(sub_clusters) if c != -1]
    
    for sub_cluster_id in unique_sub_clusters:
        cluster_mask = df['sub_cluster_id'] == sub_cluster_id
        cluster_videos = df[cluster_mask]
        
        if len(cluster_videos) > 0:
            main_cluster_id = sub_cluster_id // 1000
            wordcloud_base64, top_keywords = generate_cluster_wordcloud(
                cluster_videos, sub_cluster_id, is_subcluster=True
            )
            
            cluster_info['sub_clusters'][int(sub_cluster_id)] = {
                'sub_cluster_id': int(sub_cluster_id),
                'main_cluster_id': int(main_cluster_id),
                'label': f'Sub-cluster {sub_cluster_id % 1000} of Main {main_cluster_id}',
                'size': len(cluster_videos),
                'wordcloud_base64': wordcloud_base64,
                'top_keywords': top_keywords,
                'statistics': {
                    'avg_anomaly_score': float(cluster_videos['anomaly_score'].mean()),
                    'std_anomaly_score': float(cluster_videos['anomaly_score'].std()),
                    'high_anomaly_count': int((cluster_videos['anomaly_score'] > 0.7).sum())
                },
                'centroid': {
                    'x': float(cluster_videos['x'].mean()),
                    'y': float(cluster_videos['y'].mean()),
                    'z': float(cluster_videos['z'].mean())
                }
            }
    
    # Save results
    df.to_csv('data/df_gemini_hierarchical.csv', index=False)
    print(f"\n💾 Saved hierarchical clustering results to data/df_gemini_hierarchical.csv")
    
    with open('data/hierarchical_cluster_info.json', 'w') as f:
        json.dump(cluster_info, f, indent=2)
    print(f"💾 Saved cluster information to data/hierarchical_cluster_info.json")
    
    # Print summary
    print(f"\n📊 Clustering Summary:")
    print(f"   Main clusters: {len(unique_main_clusters)}")
    print(f"   Total sub-clusters: {len(unique_sub_clusters)}")
    print(f"   Unclustered points: {(df['main_cluster_id'] == -1).sum()}")
    
    # Print anomaly distribution
    print(f"\n🚨 Anomaly Distribution:")
    for cluster_id in unique_main_clusters:
        cluster_mask = df['main_cluster_id'] == cluster_id
        cluster_videos = df[cluster_mask]
        high_anomalies = (cluster_videos['anomaly_score'] > 0.7).sum()
        print(f"   Main Cluster {cluster_id}: {high_anomalies}/{len(cluster_videos)} high anomalies ({high_anomalies/len(cluster_videos)*100:.1f}%)")

if __name__ == '__main__':
    main()