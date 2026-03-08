# Quick Live Web

Minimal browser test client for Gemini Live.

What it does:
- opens your camera and microphone in the browser
- connects directly to Gemini Live with your API key
- sends live mic audio plus camera frames
- plays spoken answers back in the browser
- mirrors the app modes: Explorer, Vision, Memory
- uses the backend for nearby places, reverse geocoding, saved session context, directions, and captures when a backend URL is provided

Use it like this:

```bash
cd /Users/j_kanishkha/CityLens/quick-live-web
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

Recommended local flow:

1. Start the backend at `http://localhost:8000`
2. Start this web app
3. Paste your Gemini API key
4. Leave `Backend URL` as `http://localhost:8000`
5. Click `Start Live`

Notes:
- `localhost` is the easiest path because browsers allow camera/mic there without extra HTTPS setup.
- this is a local throwaway test client, not a production-safe frontend
- use headphones to avoid feedback
