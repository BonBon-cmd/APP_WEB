document.getElementById('getInfoBtn').onclick = function() {
  var infoDiv = document.getElementById('serverInfo');
  infoDiv.textContent = 'Đang lấy dữ liệu...';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/server-info');
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        infoDiv.innerHTML = `
          <ul class="info-list">
            <li><strong>Thời gian:</strong> ${data.timestamp}</li>
            <li><strong>Hệ điều hành:</strong> ${data.platform}</li>
            <li><strong>Kiến trúc CPU:</strong> ${data.arch}</li>
            <li><strong>Số lượng CPU:</strong> <span style="color:blue;">${data.cpus}</span></li>
            <li><strong>Bộ nhớ:</strong> <span style="color:green;">${(data.memory/1024/1024/1024).toFixed(2)} GB</span></li>
            <li><strong>Thời gian uptime:</strong> ${data.uptime} giây</li>
          </ul>
        `;
      } else {
        infoDiv.textContent = 'Lỗi lấy dữ liệu!';
      }
    }
  };
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.send();
};
