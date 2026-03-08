FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Patch ADK to use v1beta instead of v1alpha (required for Gemini Live on AI Studio keys)
COPY patch_adk.py .
RUN python patch_adk.py && rm patch_adk.py

COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
