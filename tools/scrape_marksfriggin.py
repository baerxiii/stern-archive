import json
import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.marksfriggin.com/news02/8-5.htm"

response = requests.get(URL, timeout=30)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

text = soup.get_text("\n")

lines = [
    line.strip()
    for line in text.splitlines()
    if line.strip()
]

segments = []

for line in lines:

    # Many MarksFriggin segment headers look like:
    # "Howard Talks About..."
    # "Robin's News"
    # etc.

    if (
        len(line) > 10 and
        len(line) < 150 and
        not re.match(r"^\d+$", line)
    ):
        segments.append({
            "title": line
        })

output = {
    "source": URL,
    "segments": segments
}

with open("segments_output.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print("Created segments_output.json")
