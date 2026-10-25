const params = new URLSearchParams(window.location.search);

const id = params.get('id');

fetch('data/library.json')
.then(res => res.json())
.then(data => {

    const item = data.find(x=>x.id===id);

    if(!item) return;

    document.getElementById('title').textContent =
        item.title;

    const player =
        document.getElementById('audioPlayer');

    player.src = item.audioUrl;

    const savedPosition =
        localStorage.getItem(
            'position_' + item.id
        );

    if(savedPosition){

        player.currentTime =
            parseFloat(savedPosition);
    }

    setInterval(()=>{

        localStorage.setItem(
            'position_' + item.id,
            player.currentTime
        );

    },3000);

    localStorage.setItem(
        'lastPlayed',
        JSON.stringify(item)
    );
});
