let libraryData = [];

fetch('data/library.json')
.then(res => res.json())
.then(data => {

    libraryData = data;

    buildLibrary(data);

    buildContinueListening();
});

function buildLibrary(items){

    const library = document.getElementById('library');

    if(!library) return;

    library.innerHTML='';

    items.forEach(item=>{

        library.innerHTML += `
        <div class="card">

            <h3>${item.title}</h3>

            <p>${item.year}</p>

            <a href="player.html?id=${item.id}">
                Play
            </a>

        </div>
        `;
    });
}

const searchBox = document.getElementById('searchBox');

if(searchBox){

    searchBox.addEventListener('input',()=>{

        const value = searchBox.value.toLowerCase();

        const filtered = libraryData.filter(item =>
            item.title.toLowerCase().includes(value)
        );

        buildLibrary(filtered);
    });
}

function buildContinueListening(){

    const card = document.getElementById('continueCard');

    if(!card) return;

    const last = JSON.parse(
        localStorage.getItem('lastPlayed')
    );

    if(!last){

        card.innerHTML="No recent listening yet.";
        return;
    }

    card.innerHTML=`
        <div class="card">
            <h3>${last.title}</h3>

            <a href="player.html?id=${last.id}">
                Resume
            </a>
        </div>
    `;
}
