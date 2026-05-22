FROM python:3.12-slim

WORKDIR /app

ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint-syllabus.sh

EXPOSE 8002

ENTRYPOINT ["sh", "/app/entrypoint-syllabus.sh"]
