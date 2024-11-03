import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

let ws;
let chartT; // Reference to the Highcharts chart
let dataBuffer = new Array(700).fill(null);
const bufferSize = 700;
const MAX_POINTS = 700; // Increased limit for better performance
let bufferIndex = 0;
var Start = 0;
var Dr = 0;
var isWebSocketConnected = false;
var isSaving = false;
var accumulatedCSVData = "";
var isReceivingCSV = false;
var receiveTimeout = null;
var DATA_RECEIVE_DELAY = 500;
var Sec = 0;
var Min = 0;
// Firebase configuration from your Firebase console

const firebaseConfig = {
  apiKey: "AIzaSyDeF4Lh29yLoLeRvzvr_IZ37p6zAXJEsus",
  authDomain: "online-ecg.firebaseapp.com",
  databaseURL:
    "https://online-ecg-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "online-ecg",
  storageBucket: "online-ecg.appspot.com",
  messagingSenderId: "806553234329",
  appId: "1:806553234329:web:9ec8ba0d49bed8cf2d4108",
  measurementId: "G-YHEWX92E4Q",
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase Realtime Database
const database = getDatabase(app);

// Reference to your data path in the Realtime Database
const dataRef = ref(database, "ecg/value");

function recivedata(){
  onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    const jsonData = JSON.parse(data);
        if (jsonData && jsonData.values && Start === 1) {
          onDataReceived(jsonData.values);
          console.log(jsonData);
        }
    //onDataReceived(jsonData);
    //onDataget(data);
    //console.log(data);
    //document.getElementById('dataDisplay').innerHTML = JSON.stringify(data, null, 2);
  });
}


function onDataget(DataF) {
  for (let i = 11; i < DataF.length; i++) {
    dataBuffer[bufferIndex] = DataF[i];
    bufferIndex = (bufferIndex + 1) % bufferSize;
    //console.log(bufferIndex);

    if (bufferIndex === 0) {
      dataBuffer.shift();
      dataBuffer.push(null);
    }

    updateChart();
  }
}

function showTab(tabId) {
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".container")
    .forEach((container) => container.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  document
    .querySelector(`.tab[onclick="showTab('${tabId}')"]`)
    .classList.add("active");
}

window.onload = function () {
  var savedIp = localStorage.getItem("savedIpAddress");
  if (savedIp) {
    document.getElementById("b").value = savedIp;
  }
};

function connectWebSocket() {
  const ipAddress = document.getElementById("b").value;
  localStorage.setItem("savedIpAddress", ipAddress);

  if (ws && ws.readyState === WebSocket.OPEN) {
    alert("WebSocket is already connected.");
    return;
  }

  ws = new WebSocket("ws://" + ipAddress + "/");

  ws.onopen = function () {
    console.log("WebSocket connection opened");
    isWebSocketConnected = true;
    alert("WebSocket connected successfully!");
  };

  ws.onmessage = function (event) {
    // Parse incoming JSON data
    try {
      const jsonData = JSON.parse(event.data);
      if (jsonData && jsonData.values && Start === 1) {
        onDataReceived(jsonData.values);
        console.log();
      }
    } catch (error) {
      console.error("Error parsing JSON data:", error);
    }
  };

  ws.onclose = function () {
    console.log("WebSocket connection closed");
    alert("WebSocket disconnected!");
  };

  ws.onerror = function (error) {
    console.log("WebSocket error:", error.message);
    alert("WebSocket connection error: " + error.message);
  };
}

function onDataReceived(newData) {
  // Add incoming data to buffer
  for (let i = 11; i < newData.length; i++) {
    dataBuffer[bufferIndex] = newData[i];
    bufferIndex = (bufferIndex + 1) % bufferSize;
    console.log(bufferIndex);
  }
  // If the buffer is full, start removing old data
  if (bufferIndex === 0) {
    dataBuffer.shift();
    dataBuffer.push(null);
  }
  Dr = Dr + newData.length;
  console.log(newData.length);
  document.getElementById("datacount").innerHTML = Dr;
  updateChart();
}

function updateChart() {
  if (!chartT) return;

  const validData = dataBuffer.filter((value) => value !== null);
  if (validData.length > MAX_POINTS) {
    validData.splice(0, validData.length - MAX_POINTS);
  }

  chartT.series[0].setData(validData, false);
  chartT.redraw();
}

function Time() {
  setInterval(function () {
    ++Sec;
    if (Sec >= 60) {
      ++Min;
      Sec = 0;
    }
    var sec = Sec.toString().padStart(2, "0");
    var min = Min.toString().padStart(2, "0");
    document.getElementById("Timer").innerHTML = min + ":" + sec;
    if (Min >= 5) {
      toggleGraph(); // Automatically stop after 5 minutes
    }
  }, 1000);
}

function toggleGraph() {
  const button = document.getElementById("startStopButton");
  if (Start === 0) {
    Start = 1;
    //Time();
    recivedata();
    button.textContent = "Stop Graph";
    if (chartT) {
      chartT.destroy();
    }
    createChart();
  } else {
    Start = 0;
    button.textContent = "Start Graph";
  }
}

function createChart() {
  chartT = Highcharts.chart("SpO2", {
    chart: { type: "spline", animation: true
      
    },
    title: { text: "" },
    series: [
      {
        data: [],
        lineWidth: 0.5,
        marker: { enabled: false },
        color: "#008000",
      },
    ],
    xAxis: {
      type: "linear",
      title: { text: "Index" },
    },
    yAxis: {
      title: { text: "ECG Data" },
      min: 0,
      max: 1300,
      tickInterval: 100,
    },
    credits: { enabled: false },
    plotOptions: {
      series: {
        states: {
          inactive: {
              enabled: false
          }
        },
        animation: false, // Disables animation to ensure a smoother live update effect
      },
    },
  });
}

function sendFilterValue() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    var filterValue = document.getElementById("filterSelect").value;
    ws.send(JSON.stringify({ filter: filterValue }));
    console.log("Sent filter value:", filterValue);
  } else {
    alert("WebSocket is not connected.");
  }
}

function toggleSave() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    isSaving = !isSaving;
    var saveStatus = isSaving ? "Stop" : "Start";
    document.getElementById(
      "toggleSaveButton"
    ).innerHTML = `${saveStatus} Save`;

    ws.send(JSON.stringify({ save: isSaving }));
    console.log("Sent save toggle state:", isSaving);
  } else {
    alert("WebSocket is not connected.");
  }
}

function fetchCSV() {
  clearCSVData();
  if (!isWebSocketConnected) {
    alert("WebSocket must be connected to fetch CSV data.");
    return;
  }

  // Request the CSV file from the server
  ws.send(JSON.stringify({ request: "csv" }));

  let receivedChunks = []; // Array to accumulate file chunks
  let isReceivingFile = false;

  ws.onmessage = function (event) {
    // Handle start and end markers for file transfer
    if (typeof event.data === "string") {
      if (event.data === "START_OF_CSV") {
        isReceivingFile = true;
        receivedChunks = []; // Reset the array for new file
        console.log("Starting CSV file reception...");
      } else if (event.data === "END_OF_CSV") {
        isReceivingFile = false;
        console.log("CSV file reception completed.");

        // Create a Blob from the received chunks
        const csvBlob = new Blob(receivedChunks, { type: "text/csv" });
        const reader = new FileReader();
        displayCSVFile(csvBlob);
        reader.onload = function () {
          const csvData = reader.result;
          processCSVData(csvData);
        };
        reader.readAsText(csvBlob);
      } else if (event.data.includes("error")) {
        console.error("Error from server:", event.data);
      }
    } else if (isReceivingFile) {
      // Collect binary chunks
      receivedChunks.push(event.data);
    }
  };
}

function processCSVData(csvData) {
  const lines = csvData.trim().split("\n");
  const data = lines.map((line) => {
    const values = line.split(",");
    return parseFloat(values[0]); // Assuming the CSV contains only one value per line
  });

  updateChart2(data);
}

function displayCSVFile(blob) {
  // Create a URL for the Blob
  const url = URL.createObjectURL(blob);

  // Create a download link for the CSV file
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "ecg_data.csv";
  downloadLink.textContent = "Download CSV File";
  document.getElementById("csvPreview").appendChild(downloadLink);

  // Revoke the Blob URL after the download
  downloadLink.onclick = function () {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Read the Blob as text and parse CSV data
  const reader = new FileReader();
  reader.onload = function (event) {
    const csvData = event.target.result;
    const parsedData = processCSVData(csvData);
  };
  reader.readAsText(blob);
}

function updateChart2(data) {
  const chart = Highcharts.chart("csvChart", {
    chart: { type: "spline" },
    title: { text: "" },
    series: [
      {
        data: data.map((value, index) => [index, value]),
        lineWidth: 0.5,
        color: "#007bff",
      },
    ],
    xAxis: {
      type: "linear",
      title: { text: "Index" },
    },
    yAxis: {
      title: { text: "ECG Data" },
    },
    credits: { enabled: false },
  });
}

function clearCSVData() {
  // Clear the CSV preview area
  const csvPreview = document.getElementById("csvPreview");
  csvPreview.innerHTML = ""; // Remove any existing download links

  // Clear the CSV chart
  const chartContainer = document.getElementById("csvChart");
  chartContainer.innerHTML = ""; // Clear any existing chart

  // Optionally, reset any other related UI elements
  console.log("CSV data cleared.");
}

window.toggleGraph = toggleGraph;
window.connectWebSocket = connectWebSocket;
window.sendFilterValue = sendFilterValue;
window.toggleSave = toggleSave;
window.showTab = showTab;
