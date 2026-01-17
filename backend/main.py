import os
from fastapi import FastAPI, Request

app = FastAPI(title="nwHacks-2026 FastAPI")

@app.get("/")
async def read_root():
    return {"message": "Hello from FastAPI"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/echo")
async def echo(request: Request):
    payload = await request.json()
    return {"you_sent": payload}

if __name__ == "__main__":
    # Run for development: `uvicorn backend.main:app --reload --port 8000`
    port = int(os.environ.get("PORT", 8000))
    try:
        import uvicorn
        uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
    except Exception:
        print("uvicorn not available - install it to run the FastAPI dev server")
