'use script';

function getData() {
  let $tableEl = $('#table');
  $.get('./db')
    .then( data => {
      $tableEl.append('<tr><th>id</th><th>city</th><th>address</th><th>latitude</th><th>longitude</th></tr>');
      data.forEach(element => {
        let $trEl = $('<tr></tr>');
        $trEl.append(`<td>${element.id}</td>`);
        $trEl.append(`<td>${element.search_query}</td>`);
        $trEl.append(`<td>${element.formatted_query}</td>`);
        $trEl.append(`<td>${element.latitude}</td>`);
        $trEl.append(`<td>${element.longitude}</td>`);
        $tableEl.append($trEl);
      });
    });
}

$(() => {
  getData();
});
