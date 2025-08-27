FROM python:3.10-slim

WORKDIR /app

# Install Python dependencies
COPY ./backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY ./backend .

EXPOSE 8000
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
