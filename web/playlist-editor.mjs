import {fold} from './mix.mjs';

async function readCover(file) {
  if (file.size > 15 * 1024 * 1024) throw Error('Выбери изображение до 15 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');
    context.fillStyle = '#151515';
    context.fillRect(0, 0, 256, 256);
    context.drawImage(image, (image.naturalWidth-size)/2, (image.naturalHeight-size)/2, size, size, 0, 0, 256, 256);
    for (const quality of [.85, .65, .45]) {
      const cover = canvas.toDataURL('image/jpeg', quality);
      if (cover.length <= 100000) return cover;
    }
    throw Error('Не удалось уменьшить обложку.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function setupPlaylistEditor({getSelected, getPlaylist, getLikes, save, onAdd, toast}) {
  const $ = id => document.getElementById(id);
  const edit = $('editPlaylistDialog'), picker = $('addPlaylistDialog');
  const selected = new Set();
  let id, cover, coverRequest = 0;
  const preview = $('playlistCoverPreview'), file = $('playlistCoverInput');
  const submit = $('savePlaylistEdit'), status = $('playlistEditStatus');
  const filter = $('playlistTrackFilter'), choices = $('playlistTrackChoices');
  const commit = $('commitPlaylistTracks');
  const updateCover = () => {
    preview.hidden = !cover;
    if (cover) preview.src = cover;
    else preview.removeAttribute('src');
    $('removePlaylistCover').disabled = !cover;
  };
  for (const dialog of [edit, picker]) dialog.querySelector('[data-close-collection]').onclick = () => dialog.close();
  $('editPlaylist').onclick = () => {
    const playlist = getSelected();
    if (!playlist) return;
    id = playlist.id;
    coverRequest++;
    cover = playlist.cover || '';
    file.value = status.textContent = '';
    submit.disabled = false;
    $('playlistNameInput').value = playlist.name;
    updateCover();
    edit.showModal();
  };
  file.onchange = async () => {
    if (!file.files.length) return;
    const request = ++coverRequest;
    submit.disabled = true;
    status.textContent = 'Готовим обложку…';
    try {
      const image = await readCover(file.files[0]);
      if (request !== coverRequest || !edit.open) return;
      cover = image;
      updateCover();
      status.textContent = '';
    } catch (error) {
      if (request === coverRequest && edit.open) status.textContent = error.message;
    } finally {
      if (request === coverRequest) submit.disabled = false;
    }
  };
  $('removePlaylistCover').onclick = () => {
    coverRequest++;
    cover = file.value = status.textContent = '';
    submit.disabled = false;
    updateCover();
  };
  $('editPlaylistForm').onsubmit = event => {
    event.preventDefault();
    const playlist = getPlaylist(id), name = $('playlistNameInput').value.trim();
    if (!playlist || submit.disabled) return;
    if (!name) { status.textContent = 'Введи название плейлиста.'; return; }
    Object.assign(playlist, {name, cover});
    edit.close();
    save();
  };

  function updateCount() {
    commit.disabled = !selected.size;
    commit.textContent = selected.size ? 'Добавить (' + selected.size + ')' : 'Добавить';
  }
  function renderChoices() {
    choices.replaceChildren();
    const existing = new Set(getPlaylist(id)?.tracks.map(track => track.id));
    const query = fold(filter.value);
    for (const track of [...getLikes()].reverse()) {
      if (existing.has(track.id) || !fold(track.title + ' ' + track.artist).includes(query)) continue;
      const label = document.createElement('label'), checkbox = document.createElement('input');
      const description = document.createElement('span'), artist = document.createElement('small');
      label.className = 'playlist-track-choice';
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(track.id);
      checkbox.onchange = () => {
        if (checkbox.checked) selected.add(track.id);
        else selected.delete(track.id);
        updateCount();
      };
      description.textContent = track.title;
      artist.textContent = track.artist;
      description.append(artist);
      label.append(checkbox, description);
      choices.append(label);
    }
    if (!choices.children.length) choices.textContent = query ? 'Совпадений нет.' : 'Нет понравившихся треков для добавления.';
    updateCount();
  }
  $('addPlaylistTracks').onclick = () => {
    const playlist = getSelected();
    if (!playlist) return;
    id = playlist.id;
    selected.clear();
    filter.value = '';
    renderChoices();
    picker.showModal();
  };
  filter.oninput = renderChoices;
  commit.onclick = () => {
    const playlist = getPlaylist(id);
    if (!playlist) return;
    const existing = new Set(playlist.tracks.map(track => track.id));
    const added = getLikes().filter(track => selected.has(track.id) && !existing.has(track.id));
    const addedAt = Date.now();
    playlist.tracks.push(...added.map(track => ({...track, addedAt})));
    added.forEach(onAdd);
    picker.close();
    save();
    toast('Добавлено треков: ' + added.length);
  };
  return {close() { coverRequest++; edit.close(); picker.close(); }};
}
