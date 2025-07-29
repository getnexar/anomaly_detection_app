# Advanced 3D Video Analysis Visualization System

A production-ready system for exploring and analyzing 450k+ dashcam videos using 3D visualization, semantic search, intelligent clustering, and anomaly detection.

![System Overview](docs/overview.png)

## 🌟 Features

### Core Capabilities
- **3D Point Cloud Visualization**: Each video represented as a positioned point in 3D space
- **Semantic Search**: AI-powered search using OpenAI embeddings
- **Intelligent Clustering**: Automatic grouping with HDBSCAN and TF-IDF labeling
- **Anomaly Detection**: Multi-method approach combining ML and rule-based detection
- **Interactive Filtering**: Advanced metadata-based filtering system
- **Video Playback**: Inline HTML5 player with streaming support

### Technical Highlights
- **Scalable Architecture**: Handles 450k+ videos with efficient data loading
- **Real-time Performance**: Optimized Three.js rendering with 60fps target
- **Apple-inspired UI**: Modern, clean interface with smooth animations
- **RESTful API**: Comprehensive Flask backend with caching and pagination
- **Multi-layered Embeddings**: Weighted combination of content, anomaly, and metadata embeddings

## 🏗️ Architecture

```
├── backend/           # Flask API server
│   ├── app.py        # Main Flask application
│   ├── api/          # API endpoints
│   ├── models/       # Data models and ML components
│   └── utils/        # Utility functions
├── frontend/         # Modern web application
│   ├── index.html    # Main HTML template
│   ├── js/           # JavaScript modules
│   │   ├── components/   # UI components
│   │   ├── services/     # API client
│   │   └── utils/        # Utilities
│   └── css/          # Stylesheets
├── data_processing/  # ML pipeline
│   ├── embedding_generator.py
│   ├── dimension_reducer.py
│   ├── clustering_engine.py
│   └── anomaly_detector.py
├── config/           # Configuration management
└── data/            # Data storage
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+ (for development tools)
- Redis (for caching)
- 8GB+ RAM (for processing 450k videos)
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd anomaly_detection_app
```

2. **Set up Python environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Configure environment**
```bash
cp .env.template .env
# Edit .env with your settings (especially OPENAI_API_KEY)
```

4. **Prepare your data**
```bash
# Place your video data CSV in data/df_gemini.csv
# Ensure it has the required columns (see Data Format section)
```

### Data Processing Pipeline

Run the complete data processing pipeline:

```bash
# 1. Generate embeddings (requires OpenAI API key)
python data_processing/embedding_generator.py \
  --input data/df_gemini.csv \
  --output data/embeddings \
  --batch-size 100

# 2. Reduce dimensions to 3D
python data_processing/dimension_reducer.py \
  --embeddings data/embeddings \
  --output data/umap_3d \
  --n-neighbors 15 \
  --min-dist 0.1

# 3. Perform clustering
python data_processing/clustering_engine.py \
  --coordinates data/umap_3d \
  --video-data data/df_gemini.csv \
  --output data/clustering \
  --min-cluster-size 50

# 4. Detect anomalies
python data_processing/anomaly_detector.py \
  --embeddings data/embeddings \
  --video-data data/df_gemini.csv \
  --output data/anomalies \
  --contamination 0.1

# 5. Build vector search index
python backend/models/vector_store.py create \
  --embeddings data/embeddings \
  --video-data data/df_gemini.csv \
  --index-path data/faiss_index \
  --index-type IndexFlatIP
```

### Running the Application

```bash
# Start Redis (for caching)
redis-server

# Start the Flask backend
python backend/app.py

# Open frontend in browser
open http://localhost:5000
```

## 📊 Data Format

Your input CSV should contain these columns:

### Required Columns
- `video_id`: Unique identifier for each video
- `video_path`: Path to the video file
- `video-title`: Descriptive title
- `description-step-by-step`: Detailed description
- `interpretation`: Analysis field (used for anomaly detection)

### Metadata Columns
- `main-event`: Event type (e.g., "normal-driving", "accident")
- `location`: Location type (e.g., "highway", "parking-lot")
- `zone`: Zone type (e.g., "urban", "suburban")
- `light-conditions`: Lighting conditions
- `weather-conditions`: Weather conditions
- `video-quality`: Video quality rating

### Example Data
```csv
video_id,video_path,video-title,description-step-by-step,interpretation,main-event,location
abc123,/path/to/video.mp4,"Highway Drive","Car driving on highway...","no anomalies observed","normal-driving","highway"
```

## 🎮 User Interface

### Navigation
- **Mouse Drag**: Rotate camera around the point cloud
- **Mouse Wheel**: Zoom in/out
- **Right Click + Drag**: Pan camera
- **Double Click**: Focus on specific point

### Keyboard Shortcuts
- `Ctrl+F`: Focus search bar
- `R`: Reset camera view
- `F`: Fit all points in view
- `A`: Focus on anomalies
- `1/2/3`: Switch view modes (clusters/anomalies/events)
- `H`: Show help
- `Escape`: Close modals

### Features
- **Search**: Semantic search using AI embeddings
- **Filters**: Filter by event type, location, weather, etc.
- **Clusters**: Explore automatically detected groups
- **Anomalies**: Highlight and focus on unusual videos
- **Video Player**: Inline playback with full controls

## 🔧 Configuration

### Environment Variables (.env)
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=text-embedding-3-large

# Flask Configuration
FLASK_SECRET_KEY=your-secret-key-here
FLASK_HOST=0.0.0.0
FLASK_PORT=5000

# Performance Settings
BATCH_SIZE=1000
WORKER_THREADS=4
MAX_MEMORY_GB=8

# Model Parameters
UMAP_N_NEIGHBORS=15
UMAP_MIN_DIST=0.1
HDBSCAN_MIN_CLUSTER_SIZE=50
ISOLATION_FOREST_CONTAMINATION=0.1
```

### Advanced Configuration
Edit `config/config.py` for detailed parameter tuning:

- **OpenAI settings**: Model, dimensions, batch size
- **UMAP parameters**: Neighbors, distance, metric
- **Clustering settings**: Minimum cluster size, algorithm
- **Anomaly detection**: Contamination rate, keywords
- **Performance tuning**: Memory limits, cache settings

## 🚀 Deployment

### Production Setup

1. **Environment Setup**
```bash
# Use production WSGI server
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 backend.app:app
```

2. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static {
        alias /path/to/anomaly_detection_app/frontend;
        expires 1y;
    }
}
```

3. **Docker Deployment**
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "backend.app:app"]
```

### Performance Optimization

For 450k+ videos:

1. **Use IVF FAISS index** for faster search:
```bash
python backend/models/vector_store.py create \
  --index-type IndexIVFFlat \
  --embeddings data/embeddings
```

2. **Enable Redis caching**:
```bash
REDIS_URL=redis://localhost:6379/0
```

3. **Optimize UMAP parameters**:
```bash
UMAP_N_NEIGHBORS=10  # Reduce for speed
UMAP_LOW_MEMORY=true
```

4. **Use CDN for video files**:
```bash
VIDEO_BASE_URL=https://your-cdn.com/videos/
```

## 🧪 Development

### Running Tests
```bash
python -m pytest tests/
```

### Development Server
```bash
# With auto-reload
FLASK_ENV=development python backend/app.py

# Frontend development (if using build tools)
cd frontend && npm install && npm run dev
```

### Code Quality
```bash
# Format code
black backend/ data_processing/

# Lint code
flake8 backend/ data_processing/

# Type checking
mypy backend/
```

## 📈 Performance Monitoring

The application includes built-in performance monitoring:

- **FPS Counter**: Real-time frame rate display
- **Memory Usage**: JavaScript heap monitoring
- **API Response Times**: Backend performance tracking
- **Point Count**: Visible data point statistics

Monitor performance in the browser console or via the performance API.

## 🐛 Troubleshooting

### Common Issues

1. **Out of Memory during embedding generation**
   - Reduce batch size: `--batch-size 50`
   - Use smaller model: `OPENAI_MODEL=text-embedding-small`

2. **Slow 3D rendering**
   - Reduce point count with filters
   - Enable performance mode in settings
   - Use fewer visual effects

3. **Search not working**
   - Check OpenAI API key
   - Verify FAISS index exists
   - Check backend logs

4. **Videos not playing**
   - Verify video file paths
   - Check video format compatibility
   - Enable CORS for video files

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=DEBUG python backend/app.py

# Frontend debug mode
localStorage.setItem('debug', 'true')
```

## 📄 API Documentation

### Video Endpoints
- `GET /api/videos` - Get paginated video list
- `GET /api/videos/{id}` - Get video details
- `POST /api/videos/search` - Semantic search
- `POST /api/videos/filter` - Filter videos
- `GET /api/videos/{id}/stream` - Stream video
- `GET /api/videos/{id}/thumbnail` - Get thumbnail

### Cluster Endpoints
- `GET /api/clusters` - Get cluster information
- `GET /api/clusters/{id}` - Get cluster details

### Anomaly Endpoints
- `GET /api/anomalies` - Get anomalous videos

### System Endpoints
- `GET /api/health` - System health check
- `GET /api/filters/metadata` - Available filters

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for embedding models
- Three.js for 3D visualization
- UMAP for dimensionality reduction
- HDBSCAN for clustering
- Flask for the web framework

---

For detailed technical documentation, see the `docs/` directory.
For issues and feature requests, use the GitHub issue tracker.