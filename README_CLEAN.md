# Video Analysis Dashboard - Clean Version

## Overview
A 3D visualization dashboard for analyzing video data with clustering, anomaly detection, and word cloud generation.

## Main Files

### Frontend
- `/frontend/index-natural-bubbles.html` - Main visualization interface with natural bubble rendering
- `/frontend/index.html` - Redirects to index-natural-bubbles.html

### Backend
- `/backend/app.py` - Flask API server
- `/config/config.py` - Configuration settings

### Data Processing
- `/data_processing/clustering_engine.py` - Clustering implementation
- `/cluster_after_umap.py` - Clusters videos based on 3D coordinates (after dimensionality reduction)

### Data Management
- `/create_real_dataset.py` - Creates dataset from real embeddings
- `/integrate_real_data.py` - Integrates real UMAP coordinates

## Quick Start

```bash
# Run the application
python3 quick_start.py
```

Access the dashboard at: http://[your-ip]:8200

## Features

1. **Natural Bubble Visualization**: Beautiful 3D bubbles with realistic rendering
2. **Cluster Analysis**: Click on clusters to see word clouds and statistics
3. **Interactive Navigation**: 
   - Left Click + Drag: Rotate view
   - Right Click + Drag: Pan camera
   - Scroll: Zoom in/out
   - Click Bubble: View video details
   - Click Cluster: View cluster word cloud

4. **Filters**: Filter by event type, location, and anomaly score
5. **Search**: Search videos by keywords
6. **View Modes**: Switch between cluster colors, anomaly colors, and event colors

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/videos` - Get all videos with pagination
- `GET /api/clusters` - Get cluster information
- `GET /api/clusters/<id>` - Get detailed cluster info with word cloud
- `GET /api/videos/<id>` - Get video details

## Old Files
Previous versions and test files have been moved to:
- `/frontend/old_versions/` - Old HTML and CSS files
- `/old_versions/` - Old Python scripts

## Architecture
The application uses:
- **Frontend**: Pure JavaScript with Three.js for 3D visualization
- **Backend**: Flask for REST API
- **Clustering**: KMeans on 3D UMAP coordinates for spatial coherence
- **Word Clouds**: Generated from video descriptions per cluster