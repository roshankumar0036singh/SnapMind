from fastapi import APIRouter, HTTPException, Request
from schemas import AnalyzeImageRequest
from collections import OrderedDict
import uuid

router = APIRouter()
vision_cache = OrderedDict()

@router.post("/analyze-image")
def analyze_image_endpoint(request: AnalyzeImageRequest, req: Request):
    """
    Analyzes an image using Vision model.
    """
    from vision import analyze_image_logic
    import base64

    # Decode base64
    try:
        if "," in request.image_data:
            image_data = request.image_data.split(",")[1]
        else:
            image_data = request.image_data
            
        image_bytes = base64.b64decode(image_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
    }
    
    result = analyze_image_logic(
        image_bytes, 
        request.prompt, 
        request.mode, 
        api_keys=api_keys, 
        target_lang=request.target_lang,
        active_context=request.active_context
    )
    
    if not result.get("success", False):
        error_detail = result.get("error") or result.get("answer") or "Unknown vision error"
        raise HTTPException(status_code=500, detail=error_detail)
        
    return result

@router.post("/cache")
async def cache_vision_image(request: Request):
    data = await request.json()
    cache_id = str(uuid.uuid4())
    vision_cache[cache_id] = data.get("image", "")
    # Strict FIFO cleanup to prevent memory leak
    while len(vision_cache) > 50:
        vision_cache.popitem(last=False)
    return {"cache_id": cache_id}

@router.get("/cache/{cache_id}")
async def get_vision_image(cache_id: str):
    if cache_id in vision_cache:
        img = vision_cache[cache_id]
        return {"image": img}
    return {"error": "Not found"}
