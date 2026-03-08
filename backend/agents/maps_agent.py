import os
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters


def create_maps_agent() -> LlmAgent:
    return LlmAgent(
        model="gemini-2.5-flash-native-audio-latest",
        name="maps_agent",
        instruction="""
        You are the maps and places specialist for CityLens.

        When the user asks about food, restaurants, cafes, bars, shows, attractions,
        or directions — use your Google Maps tools to find REAL, accurate information.

        RESPONSE FORMAT (spoken, not written):
        - Give 2-3 options maximum. Never overwhelm.
        - For each place: name, distance to walk, price range, one key fact.
        - Example: "Tom's Restaurant is a 4-minute walk — $12, the original Seinfeld diner,
          locals love the turkey club."

        PREFERENCES TO RESPECT:
        - If the user said "nothing touristy" — avoid chains and tourist traps.
        - If the user said "under $20" — only suggest options in that range.
        - If the user said "walk only" — only walking distance options.

        Always use the most recent GPS coordinates provided to find truly nearby options.
        """,
        tools=[
            McpToolset(
                connection_params=StdioConnectionParams(
                    server_params=StdioServerParameters(
                        command="npx",
                        args=["-y", "@modelcontextprotocol/server-google-maps"],
                        env={"GOOGLE_MAPS_API_KEY": os.getenv("GOOGLE_MAPS_API_KEY", "")},
                    )
                ),
            )
        ],
    )
