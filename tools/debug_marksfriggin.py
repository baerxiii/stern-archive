import requests
from bs4 import BeautifulSoup

url = "https://www.marksfriggin.com/news02/8-5.htm"

html = requests.get(url).text

soup = BeautifulSoup(html, "html.parser")

for line in soup.get_text("\n").splitlines():

    line = line.strip()

    if line:
        print(line)
