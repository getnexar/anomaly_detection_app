# Anomaly Detection App - Configuration Notes

## Server Configuration

The Flask application is configured to run on:
- **Port**: 8200
- **Host**: 0.0.0.0 (binds to all network interfaces)

## Accessing the Application

The app will be accessible via the external IP address of your server on port 8200.

When you start the server using `python3 quick_start.py` or `./run_dev.sh`, it will display the external IP address in the console output.

## Key Configuration Changes

1. **Port**: Changed from default 5000 to 8200 in `config/config.py`
2. **Host**: Set to '0.0.0.0' to accept connections from any IP address
3. **Frontend**: Served directly by Flask at the root URL
4. **API**: Available at `/api/*` endpoints

## Quick Start

```bash
cd /home/ubuntu/anomaly_detection_app
python3 quick_start.py
```

The application will start and display URLs like:
- Frontend: http://[EXTERNAL_IP]:8200
- API Health: http://[EXTERNAL_IP]:8200/api/health
- Videos API: http://[EXTERNAL_IP]:8200/api/videos

## Security Note

Running on 0.0.0.0 makes the app accessible from any network interface. In production, consider:
- Using a reverse proxy (nginx)
- Implementing authentication
- Configuring firewall rules
- Using HTTPS