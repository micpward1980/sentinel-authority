FROM python:3.11-slim

WORKDIR /app

ARG CACHEBUST=1770995632
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
# Thu Feb  5 16:52:54 CST 2026
# Thu Feb 12 02:11:05 CST 2026

# Force rebuild: bust cache
RUN echo "rebuild-$(date)"
# v4.0 deploy Fri Feb 13 09:04:11 CST 2026
