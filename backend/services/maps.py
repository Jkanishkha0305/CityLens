import os
import googlemaps

_client: googlemaps.Client | None = None


def get_client() -> googlemaps.Client:
    global _client
    if _client is None:
        _client = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY", ""))
    return _client


def search_nearby_places(query: str, lat: float, lng: float, radius_m: int = 1000) -> str:
    """Search for places near the user's current GPS location.

    Args:
        query: What to search for, e.g. "coffee", "pizza under $15", "pharmacy"
        lat: User's current latitude
        lng: User's current longitude
        radius_m: Search radius in metres (default 1000 = 1km)

    Returns:
        A formatted list of up to 3 nearby places with name, address, rating, and price level.
    """
    try:
        gmaps = get_client()
        results = gmaps.places_nearby(
            location=(lat, lng),
            radius=radius_m,
            keyword=query,
            type="establishment",
        ).get("results", [])[:3]

        if not results:
            return f"No places found for '{query}' within {radius_m}m."

        lines = []
        for r in results:
            name = r.get("name", "Unknown")
            addr = r.get("vicinity", "")
            rating = r.get("rating", "?")
            price = "💰" * r.get("price_level", 0) or "price unknown"
            open_now = r.get("opening_hours", {}).get("open_now")
            status = "open now" if open_now else ("closed" if open_now is False else "")
            lines.append(f"- {name} | {addr} | Rating: {rating}/5 | {price}{' | ' + status if status else ''}")

        return "\n".join(lines)
    except Exception as e:
        return f"Maps search failed: {e}"


def get_directions(origin_lat: float, origin_lng: float, destination: str, mode: str = "walking") -> str:
    """Get step-by-step directions from the user's current location to a destination.

    Args:
        origin_lat: User's current latitude
        origin_lng: User's current longitude
        destination: Destination address or place name
        mode: Travel mode — "walking", "driving", or "transit" (default: walking)

    Returns:
        Step-by-step directions with landmarks and estimated time.
    """
    try:
        gmaps = get_client()
        result = gmaps.directions(
            origin=f"{origin_lat},{origin_lng}",
            destination=destination,
            mode=mode,
        )

        if not result:
            return f"No directions found to '{destination}'."

        leg = result[0]["legs"][0]
        duration = leg["duration"]["text"]
        distance = leg["distance"]["text"]
        steps = leg["steps"][:6]  # First 6 steps only

        lines = [f"Directions to {destination} ({distance}, ~{duration} {mode}):"]
        for i, step in enumerate(steps, 1):
            # Strip HTML tags from instructions
            instruction = step["html_instructions"]
            for tag in ["<b>", "</b>", "<div style=\"font-size:0.9em\">", "</div>"]:
                instruction = instruction.replace(tag, "")
            import re
            instruction = re.sub(r"<[^>]+>", " ", instruction).strip()
            lines.append(f"Step {i}: {instruction} ({step['distance']['text']})")

        return "\n".join(lines)
    except Exception as e:
        return f"Directions failed: {e}"


def geocode_address(address: str) -> str:
    """Convert an address to GPS coordinates.

    Args:
        address: The address to look up

    Returns:
        Latitude and longitude of the address.
    """
    try:
        gmaps = get_client()
        result = gmaps.geocode(address)
        if not result:
            return f"Could not find coordinates for '{address}'."
        loc = result[0]["geometry"]["location"]
        formatted = result[0]["formatted_address"]
        return f"{formatted} → lat={loc['lat']:.6f}, lng={loc['lng']:.6f}"
    except Exception as e:
        return f"Geocoding failed: {e}"
