(function () {

'use strict';

window.addEventListener('load', event => {
    app.fetchStations();

    // if last station is known, show it right away without waiting for the station list to be fetched
    if (localStorage.lastStation) {
        const [stationId, zoneId] = localStorage.lastStation.split(':');

        const nearestStationEl = document.createElement('station-widget');

        nearestStationEl.setAttribute('gps', 'nofix');
        nearestStationEl.setAttribute('station-id', stationId);
        nearestStationEl.setAttribute('zone-id', zoneId);

        document.querySelector('#nearest').appendChild(nearestStationEl);
    }

    // favorite stations
    const favoriteLocationEl = document.querySelector('#favorites');

    if (localStorage.favorites) {
        const favorites = JSON.parse(localStorage.favorites);

        if (favorites.length) {
            favorites.forEach(favorite => {
                const [stationId, zoneId] = favorite.split(':');

                const stationWidget = document.createElement('station-widget');

                stationWidget.setAttribute('station-id', stationId);
                stationWidget.setAttribute('zone-id', zoneId);

                favoriteLocationEl.appendChild(stationWidget);
            });
        }
        else {
            favoriteLocationEl.querySelector('.message').removeAttribute('hidden');
        }
    }
    else {
        favoriteLocationEl.querySelector('.message').removeAttribute('hidden');
    }
});

document.querySelector('button[class="pageAction"]').addEventListener('click', event => {
    const useEl = event.currentTarget.querySelector('use');
    const stationsEl = document.querySelector('#stations');
    const currentEl = document.querySelector('#nearest');
    const favoritesEl = document.querySelector('#favorites');

    if (useEl.getAttribute('xlink:href') === 'img/ui-sprite.svg#icon-search') {
        favoritesEl.setAttribute('hidden', 'hidden');
        currentEl.setAttribute('hidden', 'hidden');
        stationsEl.removeAttribute('hidden');

        useEl.setAttribute('xlink:href', 'img/ui-sprite.svg#icon-done');
    }
    else {
        document.querySelector('#textual').setAttribute('hidden', 'hidden');
        stationsEl.setAttribute('hidden', 'hidden');
        currentEl.removeAttribute('hidden');
        favoritesEl.removeAttribute('hidden');

        useEl.setAttribute('xlink:href', 'img/ui-sprite.svg#icon-search');
    }
});

document.querySelector('input[type="search"]').addEventListener('input', event => {
    const re = new RegExp('\\b' + event.currentTarget.value, 'i');

    const filteredStations = app.stations.filter(station => {
        return re.test(station.name);
    });

    const ol = document.querySelector('#stations ol');

    if (filteredStations.length !== ol.childNodes.length) {
        ol.innerHTML = '';

        filteredStations.forEach(station => {
            const liNode = document.importNode(document.querySelector('template').content, true);

            const li = liNode.cloneNode(true);

            const span = li.querySelector('.name');
            span.textContent = station.name;

            li.querySelector('.distance').textContent = Number(station.distance) ? (parseFloat(station.distance) / 1000).toFixed(1) + ' km' : '-';

            li.querySelector('button[class="favorite"]').addEventListener('click', event => {
                const button = event.currentTarget;

                const isFavorite = button.getAttribute('data-is-favorite') === 'true' ? true : false;
console.debug('this', button, 'favorite', isFavorite);

                const icon = button.querySelector('use');

                if (isFavorite) {
console.debug('remove favorite', icon);
                    icon.setAttribute('xlink:href', 'img/ui-sprite.svg#icon-favorite_border');

                    app.removeFavorite(`${ station.id }:${ station.zone }`);
                }
                else {
console.debug('add favorite', icon);
                    icon.setAttribute('xlink:href', 'img/ui-sprite.svg#icon-favorite');

                    app.addFavorite(`${ station.id }:${ station.zone }`);
                }

                button.setAttribute('data-is-favorite', ! isFavorite);
            });

            ol.appendChild(li);
        });
    }
});

const mainEl = document.querySelector('main');

mainEl.addEventListener('removeFavorite', event => {
    app.removeFavorite(event.detail.station);
});

mainEl.addEventListener('showTextual', event => {
    const stationCode = event.detail.station;
console.debug('something clicked and bubbled to main', event, stationCode);

    if (! stationCode) { return; }

    const [stationId, zoneId] = stationCode.split(':');
console.debug('app.stations', app.stations);
    const station = app.stations.find(item => {
        return (item.id === stationId);
    });
console.debug('station', station);
    const textual = document.querySelector('#textual');
    textual.querySelector('.station-name').textContent = station.name;
// XXX remove the - 1
    const d = new Date();
    const folder = d.getFullYear() + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + (d.getDate() < 10 ? '0' : '') + d.getDate();

    const xhr = new XMLHttpRequest();

    xhr.open('GET', `json/${ folder }/zone-${ zoneId }.json`, true);
    xhr.responseType = 'json';

    xhr.onload = () => {
        if (xhr.status === 200 && xhr.response) {
            const data = xhr.response;

            document.querySelector('#textual .situation').innerHTML = data.situation;

            for (let i = 0; i < 2; i++) {
                const forecastData = data.forecasts[i];

                const fDate = new Date(forecastData.date * 1000);

                const selector = '#day' + (i + 1);

                textual.querySelector(`${ selector } > h2`).textContent = fDate.toLocaleDateString('it-IT', { weekday: 'long' });
                textual.querySelector(`${ selector } > p`).innerHTML = forecastData.description;
            }

            textual.removeAttribute('hidden');           
            document.querySelector('button[class="pageAction"] use').setAttribute('xlink:href', 'img/ui-sprite.svg#icon-done');
            document.querySelector('#nearest').setAttribute('hidden', 'hidden');
            document.querySelector('#favorites').setAttribute('hidden', 'hidden');
        }
    };

    xhr.send();
}, false);

let app = {
    version: 1,
    stations: [],
    watchPid: undefined,
    lastPosition: null,

    geoCounter: 0,
};

app.fetchStations = () => {
    const xhr = new XMLHttpRequest();

    xhr.open('GET', 'json/stations.json', true);
    xhr.responseType = 'json';
    xhr.onload = () => {
        if (xhr.status === 200 && xhr.response) {
            const stationsData = xhr.response;

            app.stations = Object.keys(stationsData).map(sid => {
                const station = stationsData[sid];

                station.id = sid;
                station.distance = '-';

                return station;
            }).sort((a, b) => { return a.name.localeCompare(b.name); });

            app.refreshStations();

            if (navigator.geolocation) {
                const geoOptions = {
                    enableHighAccuracy: true,
                    maximumAge: 30000,
                    timeout: 27000
                };

                app.watchPid = navigator.geolocation.watchPosition(app.geoSuccess, app.geoError, geoOptions);
            }
        }
    };

    xhr.send();
};

app.geoSuccess = pos => {
    const currentPos = {lat: pos.coords.latitude, lng: pos.coords.longitude};
    const lastPos = app.lastPosition;

    app.lastPosition = currentPos;

    if (lastPos) {
        // accuracy at 45N/S: ~787m
        // https://en.wikipedia.org/wiki/Decimal_degrees
        if ((lastPos.lat.toFixed(2) === currentPos.lat.toFixed(2)) && (lastPos.lng.toFixed(2) === currentPos.lng.toFixed(2))) {
console.debug('position unchanged, skip');

            return;
        }
    }

    app.geoCounter++;

    app.stations.forEach(station => {
        station.distance = haversine(currentPos, {lat: station.lat, lng: station.lng});
    });

    app.refreshStations(true);
}

app.geoError = error => {
    console.debug('error, no position available', error.code, error.message);
}

app.refreshStations = gpsFix => {
console.debug('refresh stations', gpsFix);
    if (gpsFix) {
        app.stations = app.stations.sort((a, b) => { return parseFloat(a.distance) - parseFloat(b.distance); });

        // store last station
        localStorage.lastStation = `${ app.stations[0].id }:${ app.stations[0].zone }`;
    }

    if (localStorage.lastStation) {
        let nearestStationEl = document.querySelector('#nearest station-widget');

        if (! nearestStationEl) {
            nearestStationEl = document.createElement('station-widget');

            document.querySelector('#nearest').appendChild(nearestStationEl);
        }

        const [stationId, zoneId] = localStorage.lastStation.split(':');

        nearestStationEl.setAttribute('gps', gpsFix ? 'fix' : 'nofix');
        nearestStationEl.setAttribute('station-id', stationId);
        nearestStationEl.setAttribute('zone-id', zoneId);
    }

    const ol = document.querySelector('#stations ol');
    ol.innerHTML = '';

    let favorites = [];

    if (localStorage.favorites) {
        favorites = JSON.parse(localStorage.favorites);
    }

console.debug('favorites', favorites);

    app.stations.forEach(station => {
        const liNode = document.importNode(document.querySelector('template').content, true);

        const li = liNode.cloneNode(true);
        //li.setAttribute('data-sid', station.id);

        const span = li.querySelector('.name');
        span.textContent = station.name;

        li.querySelector('.distance').textContent = Number(station.distance) ?  (parseFloat(station.distance) / 1000).toFixed(1) + ' km' : '-';

        if (favorites.some(favorite => { return favorite.indexOf(station.id) === 0; })) {
console.debug(`station ${ station } is in fav`);
            const button = li.querySelector('.favorite');

            button.setAttribute('data-is-favorite', 'true');

            button.querySelector('use').setAttribute('xlink:href', 'img/ui-sprite.svg#icon-favorite');
        }

        li.querySelector('button[class="favorite"]').addEventListener('click', event => {
            const button = event.currentTarget;

            const isFavorite = button.getAttribute('data-is-favorite') === 'true' ? true : false;
console.debug('this', button, 'favorite', isFavorite);

            const icon = button.querySelector('use');

            if (isFavorite) {
console.debug('remove favorite', icon);
                icon.setAttribute('xlink:href', 'img/ui-sprite.svg#icon-favorite_border');

                app.removeFavorite(`${ station.id }:${ station.zone }`);
            }
            else {
console.debug('add favorite', icon);
                icon.setAttribute('xlink:href', 'img/ui-sprite.svg#icon-favorite');

                app.addFavorite(`${ station.id }:${ station.zone }`);
            }

            button.setAttribute('data-is-favorite', ! isFavorite);
        });

        ol.appendChild(li);
    });
};

app.refreshFavoriteStations = () => {
    const favoriteStationsEl = document.querySelector('#favorites');

    if (localStorage.favorites) {
        const favorites = JSON.parse(localStorage.favorites);

        if (favorites.length) {
            favorites.forEach(favorite => {
                const [stationId, zoneId] = favorite.split(':');

                const stationEl = document.createElement('station-widget');

                stationEl.setAttribute('station-id', stationId);
                stationEl.setAttribute('zone-id', zoneId);

                favoriteStationsEl.appendChild(stationEl);
            });
        };
    }
};

app.addFavorite = station => {
    let favorites = [];

    if (localStorage.favorites) {
        favorites = JSON.parse(localStorage.favorites);
    }

    favorites.push(station);

    localStorage.favorites = JSON.stringify(favorites);

    document.querySelector('#favorites .message').setAttribute('hidden', 'hidden');

    const [stationId, zoneId] = station.split(':');

    const stationWidget = document.createElement('station-widget');

    stationWidget.setAttribute('station-id', stationId);
    stationWidget.setAttribute('zone-id', zoneId);

    document.querySelector('#favorites').appendChild(stationWidget);
};

app.removeFavorite = station => {
console.debug('removing favorite', station);
    const [stationId, zoneId] = station.split(':');

    const favoriteLocationEl = document.querySelector('#favorites');
    const stationEl = favoriteLocationEl.querySelector(`station-widget[station-id="${ stationId }"]`);

    if (stationEl) {
        favoriteLocationEl.removeChild(stationEl);
    }

    if (localStorage.favorites) {
        let favorites = JSON.parse(localStorage.favorites);

        if (favorites.length) {
            favorites = favorites.filter(value => value !== station);
        }

        if (favorites.length) {
            localStorage.favorites = JSON.stringify(favorites);
        }
        else {
            localStorage.removeItem('favorites');

            favoriteLocationEl.querySelector('.message').removeAttribute('hidden');
        }
    }

    app.refreshStations();
};

Math.toRadians = degrees => degrees * Math.PI / 180;

function haversine(pos1, pos2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = Math.toRadians(pos1.lat);
    const φ2 = Math.toRadians(pos2.lat);
    const Δφ = Math.toRadians(pos2.lat - pos1.lat);
    const Δλ = Math.toRadians(pos2.lng - pos1.lng);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d;
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
        console.debug('sw registered!');
    });
}

}());
