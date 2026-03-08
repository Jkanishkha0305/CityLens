FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Patch ADK to use v1beta instead of v1alpha (required for Gemini Live on AI Studio keys)
RUN python -c "\
import site, os; \
paths = site.getsitepackages(); \
[open(f, 'w').write(open(f).read().replace(\"return 'v1alpha'\", \"return 'v1beta'\")) \
 for d in paths for f in [os.path.join(d, 'google/adk/models/google_llm.py')] \
 if os.path.exists(f)]"

COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
