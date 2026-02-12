FROM python:3.11-slim

WORKDIR /app

ARG CACHEBUST=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
# Thu Feb  5 16:52:54 CST 2026
# Thu Feb 12 02:11:05 CST 2026
