// SafeRoad 통합 서비스 및 미로 게임 로직

// 1. 지도 및 통계 글로벌 변수
let map;
let markerLayerGroup;
let accidentChart = null;
let selectedLocationId = null;
let trafficAccidentData = []; // 백엔드로부터 동적 수신한 데이터셋 캐싱
let currentFilterType = "all"; // all, pedestrian, child, elderly, bicycle

// 2. 미로 게임 글로벌 변수
let playerPos = { x: 0, y: 0 };
let currentMaze = [];
let playerHp = 100;
let gameScore = 0;
let isPhoneActive = false;
let isGameOver = false;
let trafficSignal = "red"; // red, green

// 타이머 변수들
let signalInterval = null;
let gameTimeInterval = null;
let blindSpotTimeout = null;

// DOM Load 완료 시 실행
document.addEventListener("DOMContentLoaded", () => {
  // A. 지도 초기화
  initMap();
  
  // B. 행정구역 드롭다운 옵션 초기 세팅
  initRegionDropdowns();
  
  // C. 최초 데이터 로드 (서울 강남구 기준)
  loadBackendData("all", "11", "680");
  
  setupFilterEventListeners();
  initWeatherTips();

  // D. 미로 게임 초기화 (기본 미로로 로드)
  initMazeGame();
  setupGameControls();
  
  // E. 초기 탭 세팅 (통계 탭)
  switchTab('stat');
});

// ==========================================================================
// 0. 탭 메뉴 스위칭 로직 (통계 분석 <-> 등교 미로)
// ==========================================================================
window.switchTab = function(tabName) {
  const btnStat = document.getElementById("btnTabStat");
  const btnGame = document.getElementById("btnTabGame");
  const contentStat = document.getElementById("tabStatContent");
  const contentGame = document.getElementById("tabGameContent");
  
  const iconHeader = document.getElementById("tabIconHeader");
  const titleHeader = document.getElementById("tabTitleHeader");

  if (tabName === 'stat') {
    btnStat.classList.add("active");
    btnGame.classList.remove("active");
    contentStat.style.display = "block";
    contentGame.style.display = "none";
    iconHeader.className = "fa-solid fa-chart-column text-danger";
    titleHeader.innerText = "사고 피해 분석 통계";
  } else if (tabName === 'game') {
    btnStat.classList.remove("active");
    btnGame.classList.add("active");
    contentStat.style.display = "none";
    contentGame.style.display = "block";
    iconHeader.className = "fa-solid fa-gamepad text-success";
    titleHeader.innerText = "SafeRoad School Maze";
    renderMazeBoard();
  }
};


// ==========================================================================
// 1. 행정구역 선택 드롭다운 제어 로직
// ==========================================================================

function initRegionDropdowns() {
  const sidoSelect = document.getElementById("sidoSelect");
  if (!sidoSelect) return;
  sidoSelect.innerHTML = "";

  // regionMapData undefined guard
  if (typeof regionMapData === 'undefined') {
    console.error("regionMapData is not loaded. Please verify data.js is loaded successfully.");
    return;
  }

  // 1단계: 시도 채우기
  for (const sidoCode in regionMapData) {

    const option = document.createElement("option");
    option.value = sidoCode;
    option.text = regionMapData[sidoCode].name;
    sidoSelect.appendChild(option);
  }

  // 디폴트 서울특별시 설정 후 구군 채우기
  sidoSelect.value = "11";
  updateGugunOptions();
}

window.updateGugunOptions = function() {
  const sidoSelect = document.getElementById("sidoSelect");
  const gugunSelect = document.getElementById("gugunSelect");
  if (!sidoSelect || !gugunSelect) return;

  if (typeof regionMapData === 'undefined') return;

  const selectedSido = sidoSelect.value;
  gugunSelect.innerHTML = "";

  const guguns = regionMapData[selectedSido].guguns;

  for (const gugunCode in guguns) {
    const option = document.createElement("option");
    option.value = gugunCode;
    option.text = guguns[gugunCode].name;
    gugunSelect.appendChild(option);
  }
  
  // 디폴트 강남구 설정
  if (selectedSido === "11") {
    gugunSelect.value = "680";
  }
};

// 사용자가 [조회] 버튼을 누를 때 호출
window.searchRegionAccidents = function() {
  const sidoSelect = document.getElementById("sidoSelect");
  const gugunSelect = document.getElementById("gugunSelect");
  if (!sidoSelect || !gugunSelect) return;

  const sido = sidoSelect.value;
  const gugun = gugunSelect.value;

  // 1. 선택한 지역 정보 구하기
  const regionInfo = regionMapData[sido].guguns[gugun];
  if (!regionInfo) return;

  // 2. 지도 중심점을 해당 행정구역 좌표로 부드럽게 비행(FlyTo) 이동
  map.flyTo([regionInfo.lat, regionInfo.lng], 13, {
    animate: true,
    duration: 1.5
  });

  // 3. 백엔드에서 해당 행정구역의 실시간 데이터 로드
  loadBackendData(currentFilterType, sido, gugun);

  // 4. 상세 설명 초기화 및 미로 리셋
  resetLocationDetails();
  initMazeGame(null);
  switchTab('stat');
};


// ==========================================================================
// 2. Leaflet 지도 및 차트 대시보드 로직 (백엔드 연동 및 로컬 폴백 하이브리드)
// ==========================================================================

// CORS 프록시를 경유하여 공공데이터 포털 OpenAPI 직접 호출하는 클라이언트 헬퍼
async function fetchDirectFromPublicApi(filterType, sido, gugun, apiKey) {
  let endpoint = "frequentzonePedestrian/getRestFrequentzonePedestrian";
  let typeName = "보행자 사고 다발지역";
  
  if (filterType === 'child') {
    endpoint = "frequentzoneChild/getRestFrequentzoneChild";
    typeName = "어린이 보호구역 내 사고지역";
  } else if (filterType === 'elderly') {
    endpoint = "frequentzoneOldman/getRestFrequentzoneOldman";
    typeName = "고령자 사고 다발지역";
  } else if (filterType === 'bicycle') {
    endpoint = "frequentzoneBicycle/getRestFrequentzoneBicycle";
    typeName = "자전거/이륜차 사고 다발지역";
  }

  const searchYear = "2022";
  const targetApiUrl = `https://apis.data.go.kr/B552061/${endpoint}?serviceKey=${encodeURIComponent(apiKey)}&searchYearCd=${searchYear}&siDo=${sido}&guGun=${gugun}&type=json&numOfRows=10&pageNo=1`;
  
  // allorigins CORS 프록시 URL 조립
  const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetApiUrl)}`;
  
  const response = await fetch(corsProxyUrl);
  if (!response.ok) {
    throw new Error(`공공 API 요청 실패: ${response.status}`);
  }
  
  const json = await response.json();
  if (!json.items || !json.items.item || json.items.item.length === 0) {
    throw new Error("조회된 실시간 공공데이터가 없습니다.");
  }
  
  const rawItems = Array.isArray(json.items.item) ? json.items.item : [json.items.item];
  return rawItems.map((item, idx) => {
    const lat = parseFloat(item.la_crd);
    const lng = parseFloat(item.lo_crd);
    
    const accidentCount = parseInt(item.occrrnc_cnt) || 0;
    const deathCount = parseInt(item.dth_dnv_cnt) || 0;
    const heavyInjuryCount = parseInt(item.se_dnv_cnt) || 0;
    const lightInjuryCount = parseInt(item.slInfo_dnv_cnt) || 0;

    return {
      id: idx + 100,
      locationName: item.spot_nm.trim(),
      type: filterType === 'all' ? 'pedestrian' : filterType,
      typeName: typeName,
      lat: lat,
      lng: lng,
      accidentCount: accidentCount,
      deathCount: deathCount,
      heavyInjuryCount: heavyInjuryCount,
      lightInjuryCount: lightInjuryCount,
      description: `실시간 공공데이터 연동 구역입니다. 총 ${accidentCount}건의 사고가 발생했으며, 횡단 시 시야 각별 유의하십시오.`
    };
  });
}

async function loadBackendData(filterType = "all", sido = "11", gugun = "680") {
  const modeBadge = document.getElementById("modeIndicator");
  currentFilterType = filterType;
  
  try {
    const response = await fetch(`/api/accidents?type=${filterType}&sido=${sido}&gugun=${gugun}`);
    if (!response.ok) {
      throw new Error("Backend response error");
    }
    
    const result = await response.json();
    trafficAccidentData = result.data || [];
    
    // 실시간 / 가상 배지 상태 업데이트
    if (result.isRealtime) {
      modeBadge.className = "mode-badge realtime";
      modeBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> 실시간 공공데이터 연동 중';
    } else {
      modeBadge.className = "mode-badge simulate";
      modeBadge.innerHTML = '<i class="fa-solid fa-circle-play"></i> 가상 체험 모드';
    }

    renderMarkers(filterType, true);
    updateChartData(filterType, null, true);

  } catch (err) {
    console.log("Backend not running or request failed. Checking local API key for direct fetch...");
    
    const localApiKey = localStorage.getItem('safeRoadApiKey');
    if (localApiKey) {
      try {
        const directData = await fetchDirectFromPublicApi(filterType, sido, gugun, localApiKey);
        trafficAccidentData = directData;
        
        modeBadge.className = "mode-badge realtime";
        modeBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> 실시간 공공데이터 연동 중 (웹)';
        
        renderMarkers(filterType, true);
        updateChartData(filterType, null, true);
        return;
      } catch (directErr) {
        console.error("Direct public API fetch failed:", directErr);
      }
    }
    
    // Fallback to Simulation Mode if direct fetch fails or no API key exists
    modeBadge.innerHTML = '<i class="fa-solid fa-circle-play"></i> 가상 체험 모드';
    modeBadge.className = "mode-badge simulate";
    
    // 로컬 브라우저 구동 시, 선택 지역(sido-gugun) 중심점에 맞춰 가상 데이터 좌표 재배치 생성
    if (typeof simulationAccidentData !== 'undefined') {
      const regionInfo = regionMapData[sido]?.guguns[gugun] || regionMapData["11"].guguns["680"];
      const centerLat = regionInfo.lat;
      const centerLng = regionInfo.lng;
      const regionName = `${regionMapData[sido]?.name || "서울특별시"} ${regionInfo.name}`;

      // 사고 데이터 템플릿 복제 및 오프셋 적용
      const templates = filterType === "all"
        ? simulationAccidentData
        : simulationAccidentData.filter(d => d.type === filterType);

      // 동적 가상 핀 좌표 매핑
      trafficAccidentData = templates.map((tpl, idx) => {
        // tpl.offsetLat가 정의되어 있지 않은 경우에 대비한 디폴트 오프셋 설정
        const offsetLat = tpl.offsetLat || (idx === 0 ? 0.005 : (idx === 1 ? -0.004 : (idx === 2 ? 0.003 : -0.003)));
        const offsetLng = tpl.offsetLng || (idx === 0 ? -0.003 : (idx === 1 ? 0.005 : (idx === 2 ? 0.004 : -0.004)));
        
        return {
          id: tpl.id || (idx + 1),
          locationName: `${regionName} ${tpl.typeName || "사고 다발지역"} 부근`,
          type: tpl.type,
          typeName: tpl.typeName,
          lat: centerLat + offsetLat,
          lng: centerLng + offsetLng,
          accidentCount: tpl.accidentCount,
          deathCount: tpl.deathCount,
          heavyInjuryCount: tpl.heavyInjuryCount,
          lightInjuryCount: tpl.lightInjuryCount,
          description: `${regionName} 부근 모의 지점입니다. 횡단 및 모퉁이 주행 시 시야 각별 유의하십시오.`
        };
      });
    }
    
    renderMarkers(filterType, true);
    updateChartData(filterType, null, true);
  }
}

function renderMarkers(filterType = "all", preloaded = false) {
  if (!preloaded) {
    // 현재 활성화된 시도/구군 값을 읽어와 쿼리 호출
    const sido = document.getElementById("sidoSelect")?.value || "11";
    const gugun = document.getElementById("gugunSelect")?.value || "680";
    loadBackendData(filterType, sido, gugun);
    return;
  }

  markerLayerGroup.clearLayers();

  trafficAccidentData.forEach(item => {
    const customIcon = L.divIcon({
      html: `<div class="marker-pin ${item.type}"><i class="${getIconClass(item.type)}"></i></div>`,
      className: "custom-marker-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const marker = L.marker([item.lat, item.lng], { icon: customIcon });

    const popupContent = `
      <div>
        <h3>${item.locationName}</h3>
        <p><strong>유형:</strong> ${item.typeName}</p>
        <p><strong>사고 발생:</strong> ${item.accidentCount}건</p>
        <p style="margin-top: 5px; font-size:0.75rem; color: #94a3b8;">클릭 시 통계 및 미로 맵이 즉시 갱신됩니다.</p>
      </div>
    `;

    marker.bindPopup(popupContent);

    marker.on("click", () => {
      showLocationDetails(item.id);
    });

    markerLayerGroup.addLayer(marker);
  });

  if (trafficAccidentData.length > 0) {
    const bounds = L.latLngBounds(trafficAccidentData.map(item => [item.lat, item.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function getIconClass(type) {
  switch (type) {
    case "pedestrian": return "fa-solid fa-person-walking";
    case "child": return "fa-solid fa-child-reaching";
    case "elderly": return "fa-solid fa-person-cane";
    case "bicycle": return "fa-solid fa-bicycle";
    default: return "fa-solid fa-triangle-exclamation";
  }
}

function setupFilterEventListeners() {
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      filterButtons.forEach(b => b.classList.remove("active"));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add("active");

      const filterType = targetBtn.getAttribute("data-type");
      currentFilterType = filterType;

      const sido = document.getElementById("sidoSelect")?.value || "11";
      const gugun = document.getElementById("gugunSelect")?.value || "680";
      
      loadBackendData(filterType, sido, gugun);
      
      resetLocationDetails();
      initMazeGame(null);
      switchTab('stat');
    });
  });
}

function renderFallbackCharts(stats) {
  const canvas = document.getElementById("accidentChart");
  const fallbackWrapper = document.getElementById("fallbackChartWrapper");

  if (canvas) canvas.style.display = "none";
  if (fallbackWrapper) fallbackWrapper.style.display = "flex";

  const total = stats.death + stats.heavy + stats.light;
  const deathPct = total > 0 ? ((stats.death / total) * 100).toFixed(0) : 0;
  const heavyPct = total > 0 ? ((stats.heavy / total) * 100).toFixed(0) : 0;
  const lightPct = total > 0 ? ((stats.light / total) * 100).toFixed(0) : 0;

  fallbackWrapper.innerHTML = `
    <div class="fallback-bar-row">
      <div class="fallback-bar-label">
        <span>사망자 비율</span>
        <span>${stats.death}명 (${deathPct}%)</span>
      </div>
      <div class="fallback-bar-outer">
        <div class="fallback-bar-inner death" style="width: ${deathPct}%;"></div>
      </div>
    </div>
    <div class="fallback-bar-row">
      <div class="fallback-bar-label">
        <span>중상자 비율</span>
        <span>${stats.heavy}명 (${heavyPct}%)</span>
      </div>
      <div class="fallback-bar-outer">
        <div class="fallback-bar-inner heavy" style="width: ${heavyPct}%;"></div>
      </div>
    </div>
    <div class="fallback-bar-row">
      <div class="fallback-bar-label">
        <span>경상자 비율</span>
        <span>${stats.light}명 (${lightPct}%)</span>
      </div>
      <div class="fallback-bar-outer">
        <div class="fallback-bar-inner light" style="width: ${lightPct}%;"></div>
      </div>
    </div>
  `;
}

function updateChartData(filterType = "all", singleLocationData = null, preloaded = false) {
  if (!preloaded && !singleLocationData) {
    const sido = document.getElementById("sidoSelect")?.value || "11";
    const gugun = document.getElementById("gugunSelect")?.value || "680";
    loadBackendData(filterType, sido, gugun);
    return;
  }

  let stats = { death: 0, heavy: 0, light: 0 };

  if (singleLocationData) {
    stats.death = singleLocationData.deathCount;
    stats.heavy = singleLocationData.heavyInjuryCount;
    stats.light = singleLocationData.lightInjuryCount;
  } else {
    trafficAccidentData.forEach(item => {
      stats.death += item.deathCount;
      stats.heavy += item.heavyInjuryCount;
      stats.light += item.lightInjuryCount;
    });
  }

  const summaryContainer = document.getElementById("statSummary");
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="stat-box danger-val">
        <span class="stat-label">사망자 수</span>
        <span class="stat-val">${stats.death}명</span>
      </div>
      <div class="stat-box warning-val">
        <span class="stat-label">중상자 수</span>
        <span class="stat-val">${stats.heavy}명</span>
      </div>
      <div class="stat-box info-val">
        <span class="stat-label">경상자 수</span>
        <span class="stat-val">${stats.light}명</span>
      </div>
    `;
  }

  if (typeof Chart === 'undefined') {
    renderFallbackCharts(stats);
    return;
  }

  const canvas = document.getElementById("accidentChart");
  const fallbackWrapper = document.getElementById("fallbackChartWrapper");
  
  if (canvas) canvas.style.display = "block";
  if (fallbackWrapper) fallbackWrapper.style.display = "none";

  const ctx = canvas.getContext("2d");
  if (accidentChart) {
    accidentChart.destroy();
  }

  accidentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['사망자', '중상자', '경상자'],
      datasets: [{
        data: [stats.death, stats.heavy, stats.light],
        backgroundColor: ['#ef4444', '#f59e0b', '#06b6d4'],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: {
              family: 'Noto Sans KR',
              size: 11
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function showLocationDetails(id) {
  const item = trafficAccidentData.find(d => d.id === id);
  if (!item) return;

  selectedLocationId = id;
  const detailContent = document.getElementById("detailContent");

  const totalCasualties = item.deathCount + item.heavyInjuryCount + item.lightInjuryCount;

  detailContent.innerHTML = `
    <div class="detail-active">
      <div class="detail-title">${item.locationName}</div>
      <div class="detail-row">
        <span>사고 유형</span>
        <span style="color: ${getAccentColor(item.type)}">${item.typeName}</span>
      </div>
      <div class="detail-row">
        <span>사고 발생 빈도</span>
        <span style="font-weight: 700;">총 ${item.accidentCount}건</span>
      </div>
      <div class="detail-row">
        <span>총 인명 피해</span>
        <span>${totalCasualties}명</span>
      </div>
      <div class="detail-description">
        <strong>보행자 교통 가이드:</strong><br>
        ${item.description}
      </div>
    </div>
  `;

  updateChartData("all", item, true);
  
  let maze = item.mazeLayout;
  if (!maze) {
    maze = generateDynamicMazeLayout(item.type);
  }
  initMazeGame(maze, item.locationName);

  switchTab('game');
}

function generateDynamicMazeLayout(accidentType) {
  if (typeof simulationAccidentData !== 'undefined') {
    const preset = simulationAccidentData.find(c => c.type === accidentType) || simulationAccidentData[0];
    return preset.mazeLayout;
  }
  return defaultMazeLayout;
}

function resetLocationDetails() {
  selectedLocationId = null;
  const detailContent = document.getElementById("detailContent");
  detailContent.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-map-pin"></i>
      <p>지도의 핀을 탭하여 해당 구역의 상세 사고 통계와 예방 수칙을 확인하세요.</p>
    </div>
  `;
}

function getAccentColor(type) {
  switch (type) {
    case "pedestrian": return "#ef4444";
    case "child": return "#f59e0b";
    case "elderly": return "#f97316";
    case "bicycle": return "#06b6d4";
    default: return "#6366f1";
  }
}

function initWeatherTips() {
  const tips = [
    { text: "날씨 경고: 빗길 보행 시 우산이 시야를 가려 위험할 수 있습니다. 횡단 전 넓게 살피세요!", icon: "fa-cloud-showers-heavy" },
    { text: "보행 수칙: 어린이 보호구역 내 모든 횡단보도는 일단 멈춤 후 좌우 확인이 기본입니다.", icon: "fa-person-running" },
    { text: "스몸비 금지: 횡단보도를 건너며 스마트폰을 확인하는 것은 눈을 감고 걷는 것과 같습니다.", icon: "fa-mobile-screen-button" },
    { text: "야간 보행 팁: 밤길 보행 시에는 반사 스티커가 있거나 밝은 톤의 의상을 입어야 안전합니다.", icon: "fa-lightbulb" }
  ];

  let currentTipIndex = 0;
  const banner = document.getElementById("warningBanner");

  setInterval(() => {
    currentTipIndex = (currentTipIndex + 1) % tips.length;
    const currentTip = tips[currentTipIndex];

    if (banner) {
      banner.style.opacity = 0;
      setTimeout(() => {
        banner.innerHTML = `<i class="fa-solid ${currentTip.icon}"></i><p id="warningText">${currentTip.text}</p>`;
        banner.style.opacity = 1;
      }, 400);
    }
  }, 10000);
}


// ==========================================================================
// 3. SafeRoad School Maze 게임 로직 (보행 학생 시점)
// ==========================================================================

window.initMazeGame = function(layout = null, name = "기본 등교길") {
  const template = layout ? layout : defaultMazeLayout;
  
  currentMaze = template.map(row => [...row]);
  
  playerHp = 100;
  gameScore = 0;
  isPhoneActive = false;
  isGameOver = false;
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (currentMaze[r][c] === 'S') {
        playerPos = { x: c, y: r };
      }
    }
  }

  document.getElementById("smartphoneOverlay").style.display = "none";
  document.getElementById("gameMessageOverlay").style.display = "none";
  updateGameHUD();
  
  startSignalTimer();
  renderMazeBoard();
};

function renderMazeBoard() {
  const board = document.getElementById("mazeBoard");
  if (!board) return;
  board.innerHTML = "";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const tileValue = currentMaze[r][c];
      const tileDiv = document.createElement("div");
      tileDiv.classList.add("tile");
      tileDiv.setAttribute("id", `tile-${r}-${c}`);

      if (tileValue === 'W') tileDiv.classList.add("tile-wall");
      else if (tileValue === 'S' || tileValue === 'S') tileDiv.classList.add("tile-sidewalk");
      else if (tileValue === 'R') tileDiv.classList.add("tile-road");
      else if (tileValue === 'T') {
        tileDiv.classList.add("tile-signal");
        tileDiv.classList.add(trafficSignal === "green" ? "active-green" : "active-red");
      }
      else if (tileValue === 'B') tileDiv.classList.add("tile-blind");
      else if (tileValue === 'E') {
        tileDiv.classList.add("tile-school");
        tileDiv.innerHTML = '<i class="fa-solid fa-school text-pink"></i>';
      }

      if (r === playerPos.y && c === playerPos.x) {
        tileDiv.classList.add("tile-player");
        tileDiv.innerHTML = '<i class="fa-solid fa-graduation-cap"></i>';
      }

      board.appendChild(tileDiv);
    }
  }
}

function startSignalTimer() {
  if (signalInterval) clearInterval(signalInterval);
  
  const signalLight = document.getElementById("pedestrianSignalLight");

  signalInterval = setInterval(() => {
    if (isGameOver) return;

    trafficSignal = (trafficSignal === "red") ? "green" : "red";
    
    if (signalLight) {
      if (trafficSignal === "green") {
        signalLight.className = "light-bulb green";
      } else {
        signalLight.className = "light-bulb red";
      }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentMaze[r][c] === 'T') {
          const tile = document.getElementById(`tile-${r}-${c}`);
          if (tile) {
            tile.className = "tile tile-signal " + (trafficSignal === "green" ? "active-green" : "active-red");
          }
        }
      }
    }
  }, 3000);
}

function setupGameControls() {
  window.addEventListener("keydown", (e) => {
    const contentGame = document.getElementById("tabGameContent");
    if (!contentGame || contentGame.style.display === "none") return;

    if (isGameOver || document.getElementById("gameMessageOverlay").style.display !== "none") return;

    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      movePlayer("up");
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      movePlayer("down");
    } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      movePlayer("left");
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      movePlayer("right");
    }
  });
}

window.movePlayer = function(dir) {
  if (isGameOver) return;

  let moveDir = dir;
  
  if (isPhoneActive) {
    if (dir === "up") moveDir = "down";
    else if (dir === "down") moveDir = "up";
    else if (dir === "left") moveDir = "right";
    else if (dir === "right") moveDir = "left";
  }

  let nextX = playerPos.x;
  let nextY = playerPos.y;

  if (moveDir === "up") nextY -= 1;
  else if (moveDir === "down") nextY += 1;
  else if (moveDir === "left") nextX -= 1;
  else if (moveDir === "right") nextX += 1;

  if (nextX < 0 || nextX > 7 || nextY < 0 || nextY > 7) return;
  if (currentMaze[nextY][nextX] === 'W') return;

  playerPos.x = nextX;
  playerPos.y = nextY;
  
  gameScore += 10;
  
  evaluateCurrentTile();

  if (!isPhoneActive && Math.random() < 0.1) {
    triggerSmombiePhone();
  }

  renderMazeBoard();
  updateGameHUD();
};

function evaluateCurrentTile() {
  const currentTileVal = currentMaze[playerPos.y][playerPos.x];

  if (currentTileVal === 'R') {
    playerHp -= 15;
    if (playerHp < 0) playerHp = 0;
    triggerFeedbackAlert("차도 무단 진입!", "인도가 아닌 차도로 직접 걷는 것은 매우 위험합니다. 인도로 대피하십시오. (HP -15)", true);
  }
  else if (currentTileVal === 'T') {
    if (trafficSignal === "red") {
      playerHp -= 35;
      if (playerHp < 0) playerHp = 0;
      triggerFeedbackAlert("무단횡단 충돌 사고!", "빨간불에 건너가려다 다가오는 우회전 차량과 충돌할 뻔했습니다. (HP -35)", true);
    } else {
      gameScore += 100;
      triggerFeedbackAlert("안전 보행!", "신호등이 초록불일 때 횡단보도를 잘 건너갔습니다. (+100점)", false);
    }
  }
  else if (currentTileVal === 'B') {
    triggerBlindSpotQuiz();
  }
  else if (currentTileVal === 'E') {
    finishGameMaze();
  }
}

function triggerBlindSpotQuiz() {
  const randIdx = Math.floor(Math.random() * pedestrianQuizData.length);
  const quiz = pedestrianQuizData[randIdx];

  const msgOverlay = document.getElementById("gameMessageOverlay");
  const msgIcon = document.getElementById("msgIcon");
  const msgTitle = document.getElementById("msgTitle");
  const msgBody = document.getElementById("msgBody");

  msgOverlay.style.display = "flex";
  msgIcon.className = "fa-solid fa-circle-question text-info";
  msgTitle.innerText = "골목 사각지대 돌발 퀴즈";
  
  let quizOptionsHtml = quiz.options.map((opt, idx) => `
    <button class="phone-btn" style="margin-top:0.4rem; text-align:left;" onclick="evaluateBlindQuiz(${randIdx}, ${idx})">
      ${idx + 1}. ${opt}
    </button>
  `).join('');

  msgBody.innerHTML = `
    <div style="font-size:0.85rem; font-weight:700; margin-bottom: 0.8rem; text-align:left; color:#fff;">
      ${quiz.question}
    </div>
    <div style="display:flex; flex-direction:column; gap:0.4rem; width:100%;">
      ${quizOptionsHtml}
    </div>
  `;
  
  const defaultBtn = msgOverlay.querySelector(".restart-game-btn");
  if (defaultBtn) defaultBtn.style.display = "none";
}

window.evaluateBlindQuiz = function(quizIdx, answerIdx) {
  const quiz = pedestrianQuizData[quizIdx];
  const msgBody = document.getElementById("msgBody");
  const isCorrect = answerIdx === quiz.answer;

  let feedbackText = "";
  if (isCorrect) {
    gameScore += 300;
    feedbackText = `
      <p style="color:var(--success); font-weight:700;"><i class="fa-solid fa-circle-check"></i> 정답입니다! (+300점)</p>
      <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:5px;">${quiz.explanation}</p>
    `;
  } else {
    playerHp -= 25;
    if (playerHp < 0) playerHp = 0;
    feedbackText = `
      <p style="color:var(--danger); font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> 오답입니다! (HP -25)</p>
      <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:5px;">${quiz.explanation}</p>
    `;
  }

  msgBody.innerHTML = `
    ${feedbackText}
    <button class="restart-game-btn" style="margin-top:1rem; width:100%;" onclick="closeQuizOverlay()">돌아가기</button>
  `;
  
  updateGameHUD();
};

window.closeQuizOverlay = function() {
  const msgOverlay = document.getElementById("gameMessageOverlay");
  msgOverlay.style.display = "none";
  
  const defaultBtn = msgOverlay.querySelector(".restart-game-btn");
  if (defaultBtn) defaultBtn.style.display = "block";

  currentMaze[playerPos.y][playerPos.x] = 'S';
  renderMazeBoard();
  
  checkGameLife();
};

function triggerSmombiePhone() {
  isPhoneActive = true;
  document.getElementById("smartphoneOverlay").style.display = "flex";
}

window.disablePhoneScreen = function() {
  isPhoneActive = false;
  document.getElementById("smartphoneOverlay").style.display = "none";
  triggerFeedbackAlert("보행 전방 집중!", "폰을 안전하게 주머니에 넣었습니다. 조작 방향이 정상화됩니다.", false);
};

function finishGameMaze() {
  isGameOver = true;
  clearInterval(signalInterval);

  const msgOverlay = document.getElementById("gameMessageOverlay");
  const msgIcon = document.getElementById("msgIcon");
  const msgTitle = document.getElementById("msgTitle");
  const msgBody = document.getElementById("msgBody");

  msgOverlay.style.display = "flex";
  msgIcon.className = "fa-solid fa-trophy text-warning pulse-icon";
  msgTitle.innerText = "등교 완료!";
  
  let grade = "S";
  if (playerHp < 50) grade = "B";
  else if (playerHp < 80) grade = "A";

  msgBody.innerHTML = `
    <span style="font-family:var(--font-digital); font-size:2rem; font-weight:800; color:var(--success); display:block; margin: 0.5rem 0;">Rank ${grade}</span>
    안전하게 횡단보도를 건너 교통 안전 규칙을 지키며 무사히 학교에 도착했습니다!<br>
    최종 획득 점수: <strong>${gameScore}점</strong><br>
    잔여 생명력: <strong>${playerHp}%</strong>
  `;
}

function checkGameLife() {
  if (playerHp <= 0) {
    isGameOver = true;
    clearInterval(signalInterval);

    const msgOverlay = document.getElementById("gameMessageOverlay");
    const msgIcon = document.getElementById("msgIcon");
    const msgTitle = document.getElementById("msgTitle");
    const msgBody = document.getElementById("msgBody");

    msgOverlay.style.display = "flex";
    msgIcon.className = "fa-solid fa-user-injured text-danger";
    msgTitle.innerText = "등교 실패 (병원 입원)";
    msgBody.innerHTML = `
      <span style="font-family:var(--font-digital); font-size:2rem; font-weight:800; color:var(--danger); display:block; margin: 0.5rem 0;">Rank F</span>
      보행 위험 요소를 조심하지 않아 충돌 사고가 발생했습니다.<br>
      실제 학교 근처에서도 횡단보도와 골목길 모퉁이를 지날 때는 신호와 사각지대를 반드시 확인해야 합니다!
    `;
  }
}

function updateGameHUD() {
  const hpBar = document.getElementById("gameHpBar");
  const hpText = document.getElementById("gameHpText");
  const scoreText = document.getElementById("gameScoreText");
  
  if (hpBar) hpBar.style.width = `${playerHp}%`;
  if (hpText) hpText.innerText = playerHp;
  if (scoreText) scoreText.innerText = String(gameScore).padStart(4, '0');
}

function triggerFeedbackAlert(title, text, isDanger = false) {
  const detailContent = document.getElementById("detailContent");
  if (!detailContent) return;
  detailContent.innerHTML = `
    <div class="detail-active">
      <div class="detail-title" style="color: ${isDanger ? 'var(--danger)' : 'var(--success)'};">
        <i class="${isDanger ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check'}"></i> ${title}
      </div>
      <div class="detail-description" style="border-left-color: ${isDanger ? 'var(--danger)' : 'var(--success)'};">
        ${text}
      </div>
    </div>
  `;
  
  if (isDanger) {
    checkGameLife();
  }
}

// ==========================================================================
// 4. API 키 설정 모달 제어 로직 (백엔드 연동 및 로컬스토리지 하이브리드)
// ==========================================================================

window.openSettingsModal = function() {
  const modal = document.getElementById("settingsModal");
  modal.style.display = "flex";
  
  // 이미 저장된 API 키가 있다면 불러오기
  const localApiKey = localStorage.getItem('safeRoadApiKey');
  document.getElementById("apiKeyInput").value = localApiKey || "";
  
  // 정적 웹 호스팅 환경(GitHub Pages, file:// 프로토콜 등) 감지
  const isStaticHost = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
  const modalTip = document.querySelector(".modal-tip");
  
  if (isStaticHost && modalTip) {
    modalTip.style.color = "#a855f7"; // 보라색 강조색
    modalTip.innerHTML = `ℹ️ <strong>안내:</strong> 현재 GitHub Pages(정적 호스팅) 환경으로 실행 중입니다. 입력하신 인증키는 서버가 아닌 <strong>브라우저 저장소(LocalStorage)</strong>에 개별 저장되어 공공데이터 API를 직접 호출합니다.`;
  } else if (modalTip) {
    modalTip.style.color = "#94a3b8"; // 기존 기본 색상
    modalTip.innerHTML = `※ 입력된 인증키는 브라우저 노출을 방지하기 위해 로컬 백엔드 서버(config.json)에만 안전하게 보관됩니다.`;
  }
};

window.closeSettingsModal = function() {
  document.getElementById("settingsModal").style.display = "none";
};

window.toggleApiKeyVisibility = function() {
  const input = document.getElementById("apiKeyInput");
  const btn = document.getElementById("btnToggleVis");
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
  } else {
    input.type = "password";
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
  }
};

window.saveApiKey = async function() {
  const apiKey = document.getElementById("apiKeyInput").value.trim();
  const isStaticHost = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';

  if (!apiKey) {
    // 정적 호스팅 환경에서 빈 입력값을 제출하면 키 삭제 및 가상모드 전환
    if (isStaticHost) {
      localStorage.removeItem('safeRoadApiKey');
      alert("인증키가 삭제되었습니다. 가상 체험 모드로 실행됩니다.");
      closeSettingsModal();
      location.reload();
      return;
    }
    alert("인증키를 입력해 주세요.");
    return;
  }

  // 정적 호스팅 환경인 경우 로컬스토리지에 저장하고 다이렉트 연동 활성화
  if (isStaticHost) {
    localStorage.setItem('safeRoadApiKey', apiKey);
    alert("성공: API 인증키가 브라우저 로컬 저장소(LocalStorage)에 안전하게 저장되었습니다.\n실시간 공공데이터 연동을 시작합니다!");
    closeSettingsModal();
    location.reload();
    return;
  }

  try {
    const response = await fetch('/api/save-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey: apiKey })
    });

    const result = await response.json();
    if (result.success) {
      alert("성공: API 인증키가 백엔드에 안전하게 저장되었습니다.\n실시간 연동을 위해 화면을 새로고침합니다.");
      closeSettingsModal();
      location.reload();
    } else {
      alert("오류: " + result.message);
    }
  } catch (err) {
    console.error("Save key failed:", err);
    alert("서버 연결 실패: Node.js 로컬 서버가 구동 중인지 확인하세요.");
  }
};
