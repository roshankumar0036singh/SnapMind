from fastapi import APIRouter, HTTPException, Request, Depends
from security import get_user_id
from schemas import LinkedInParseRequest
from services.scrapers.linkedin_posts_scraper import LinkedInPostsScraper
from services.ingest_service import IngestService
from models.dtos import IngestRequestDTO

router = APIRouter()
ingest_service = IngestService()

@router.post("/parse")
async def parse_linkedin_post(
    request: LinkedInParseRequest, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Parse pre-extracted LinkedIn post content from the user's browser session.
    This avoids Auth Walls by using the user's logged-in session.
    """
    if not request.raw_text:
        raise HTTPException(status_code=400, detail="Missing raw text")
        
    try:
        # Parse the structured data from the raw HTML
        parsed_data = LinkedInPostsScraper.parse_post_content(request.raw_text, post_url=request.url)
        
        # If content couldn't be parsed reliably, fallback to using raw text as content
        if not parsed_data["content"] and len(request.raw_text) > 50:
            parsed_data["content"] = request.raw_text[:2000] # Cap length just in case
            parsed_data["author"] = "Extracted Post"
            
        # Format the parsed data nicely for RAG ingestion
        formatted_text = f"**Author:** {parsed_data.get('author')}\n"
        if parsed_data.get('author_headline'):
            formatted_text += f"**Headline:** {parsed_data.get('author_headline')}\n"
        if parsed_data.get('posted_at') and parsed_data.get('posted_at') != "Unknown":
            formatted_text += f"**Posted:** {parsed_data.get('posted_at')}\n"
        
        formatted_text += f"\n**Post Content:**\n{parsed_data.get('content')}\n"
        
        metrics = []
        if parsed_data.get('likes'): metrics.append(f"{parsed_data['likes']} Likes")
        if parsed_data.get('comments'): metrics.append(f"{parsed_data['comments']} Comments")
        if parsed_data.get('reposts'): metrics.append(f"{parsed_data['reposts']} Reposts")
        
        if metrics:
            formatted_text += f"\n**Engagement:** {' | '.join(metrics)}\n"
            
        if parsed_data.get('hashtags'):
            formatted_text += f"**Tags:** {' '.join(parsed_data['hashtags'])}\n"
            
        # Prepare IngestRequest
        ingest_req = IngestRequestDTO(
            url=request.url,
            text=formatted_text,
            title=f"LinkedIn Post by {parsed_data.get('author')}",
            session_id=request.session_id,
            workspace_id=request.workspace_id,
            user_id=user_id
        )
        
        # We need to ingest this into the session if provided
        api_keys = {
            "mistral": req.headers.get("x-mistral-key"), 
            "gemini": req.headers.get("x-gemini-key")
        }
        
        ingest_resp = await ingest_service.ingest_text(request=ingest_req, api_keys=api_keys)
        
        return {
            "success": True,
            "parsed_data": parsed_data,
            "ingest_result": ingest_resp
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse LinkedIn post: {str(e)}")

@router.post("/scrape-post")
async def scrape_linkedin_post(
    url: str, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Attempt to scrape a public LinkedIn post headlessly (Fallback for API users).
    Will likely fail for private/protected posts.
    """
    try:
        parsed_data, error = await LinkedInPostsScraper.scrape_post(url)
        
        if error:
            raise HTTPException(status_code=403, detail=f"Scraping failed (Auth Wall likely): {error}")
            
        return {
            "success": True,
            "parsed_data": parsed_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
