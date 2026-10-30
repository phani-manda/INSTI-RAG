FROM python:3.12-slim

WORKDIR /app

# Copy dependency files first (better caching)
COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt 

# Copy only necessary application files
COPY app.py ./
COPY static ./static

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
