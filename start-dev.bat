@echo off
echo Starting Tailor Management System Backend & Frontend...
start "TMS Backend (Port 5000)" cmd /k "cd backend && npm run dev"
start "TMS Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"
echo.
echo ===================================================
echo Both servers launched in separate terminal windows!
echo - Frontend:    http://localhost:5173
echo - Backend API: http://localhost:5000/api/v1
echo ===================================================
