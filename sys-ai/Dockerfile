FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
WORKDIR /app
COPY requirements.txt /app/
RUN apt-get update && apt-get install -y libpq-dev gcc && \
    pip install --upgrade pip && \
    pip install -r requirements.txt && \
    apt-get clean
COPY . /app/
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
