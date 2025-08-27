FROM python:3.10-slim

WORKDIR /app

# Install kubectl for Kubernetes operations
RUN apt-get update && apt-get install -y curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    apt-get remove -y curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY ./backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt kubernetes

# Copy worker code
COPY ./backend/main.py .

CMD ["python", "main.py"]