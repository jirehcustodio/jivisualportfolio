IoT Air Quality Monitor demo

How it works:
- Backend: Node/Express server at Backend/air-quality-backend (port 4002)
  - Endpoints: /ingest (POST), /readings, /live (SSE), /simulate, /thresholds, /health
- Frontend: this page connects to :4002, streams live data, draws a chart, and highlights when thresholds are exceeded.

Steps:
1) npm install
2) npm start
In: Backend/air-quality-backend

Open portfolio/demo-air-quality.html in a browser. Use the Simulate button for sample readings.
