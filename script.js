// ======================================
// HEALTHTRACK - HEALTH ANALYTICS SYSTEM
// ======================================

// Load saved data safely. LocalStorage is browser-side storage, not secure storage.
function loadStoredArray(key) {
    try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) return [];

        const parsedValue = JSON.parse(rawValue);
        return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (error) {
        console.error(`Unable to load ${key}:`, error);
        return [];
    }
}

let patients = loadStoredArray("healthPatients");
let records = loadStoredArray("healthRecords");

let healthChart = null;
let selectedRecordDate = "";

// ======================================
// COMMON FUNCTIONS
// ======================================

// Save Data
function saveData() {
    try {
        localStorage.setItem("healthPatients", JSON.stringify(patients));
        localStorage.setItem("healthRecords", JSON.stringify(records));
        return true;
    } catch (error) {
        console.error("Unable to save HealthTrack data:", error);
        alert("Your data could not be saved. Browser storage may be unavailable or full.");
        return false;
    }
}

// Generate Patient ID
function generatePatientID() {
    return "PT-" + Date.now().toString().slice(-6);
}

// Safe HTML Output
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// BMI Category
function getBMICategory(bmi) {
    bmi = Number(bmi);

    if (!Number.isFinite(bmi) || bmi <= 0) return "Unknown";
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal";
    if (bmi < 30) return "Overweight";

    return "Obese";
}

// Get Local Date
function getLocalDateString(dateValue) {
    const date = new Date(dateValue);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ======================================
// PATIENT MANAGEMENT
// ======================================

const patientModal = document.getElementById("patientModal");
const patientForm = document.getElementById("patientForm");

// Open Patient Modal
document.getElementById("addPatientBtn").addEventListener("click", () => {
    patientForm.reset();
    patientModal.classList.add("show");
});

// Close Patient Modal
function closePatientModal() {
    patientModal.classList.remove("show");
}

document.getElementById("closePatientModal")
    .addEventListener("click", closePatientModal);

document.getElementById("cancelPatient")
    .addEventListener("click", closePatientModal);

// Close when clicking outside
patientModal.addEventListener("click", event => {
    if (event.target === patientModal) {
        closePatientModal();
    }
});

// Save Patient
patientForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("patientName").value.trim();
    const age = Number(document.getElementById("patientAge").value);
    const gender = document.getElementById("patientGender").value;
    const contact = document.getElementById("patientContact").value.trim();

    if (!name || !gender || !contact ||
        !Number.isInteger(age) || age < 1 || age > 120) {

        alert("Please enter valid patient details.");
        return;
    }

    const patient = {
        id: generatePatientID(),
        name,
        age,
        gender,
        contact
    };

    patients.push(patient);

    saveData();
    renderPatients();
    updateDashboard();

    closePatientModal();
    patientForm.reset();

    alert("Patient registered successfully!");
});

// Display Patients
function renderPatients(searchText = "") {

    const table = document.getElementById("patientTable");

    table.innerHTML = "";

    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchText.toLowerCase()) ||
        patient.id.toLowerCase().includes(searchText.toLowerCase())
    );

    if (filteredPatients.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No patients found.
                </td>
            </tr>
        `;

        return;
    }

    filteredPatients.forEach(patient => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(patient.id)}</td>
            <td>${escapeHTML(patient.name)}</td>
            <td>${patient.age}</td>
            <td>${escapeHTML(patient.gender)}</td>
            <td>${escapeHTML(patient.contact)}</td>
            <td>
                <button class="edit-btn" data-id="${escapeHTML(patient.id)}">Edit</button>
                <button class="delete-btn" data-id="${escapeHTML(patient.id)}">Delete</button>
            </td>
        `;

        table.appendChild(row);
    });
}

// Search Patients
document.getElementById("searchPatient")
    .addEventListener("input", function () {
        renderPatients(this.value);
    });

// Edit and Delete Patients
document.getElementById("patientTable")
    .addEventListener("click", function (event) {

        const patientId = event.target.dataset.id;

        if (!patientId) return;

        if (event.target.classList.contains("delete-btn")) {

            if (confirm("Delete this patient and their health records?")) {

                patients = patients.filter(patient => patient.id !== patientId);

                records = records.filter(record => record.patientId !== patientId);

                saveData();

                renderPatients();
                renderRecords();
                updateDashboard();
                updateChart();
            }
        }

        if (event.target.classList.contains("edit-btn")) {

            const patient = patients.find(patient => patient.id === patientId);

            if (!patient) return;

            const newName = prompt("Enter new name:", patient.name);

            if (!newName || !newName.trim()) return;

            const newAge = Number(prompt("Enter new age:", patient.age));

            if (!Number.isInteger(newAge) || newAge < 1 || newAge > 120) {

                alert("Invalid age.");
                return;
            }

            const newContact = prompt("Enter new contact:", patient.contact);

            if (!newContact || !newContact.trim()) return;

            patient.name = newName.trim();
            patient.age = newAge;
            patient.contact = newContact.trim();

            // Update patient name in existing records
            records.forEach(record => {

                if (record.patientId === patientId) {
                    record.patientName = patient.name;
                }

            });

            saveData();

            renderPatients();
            renderRecords();
            updateDashboard();

            alert("Patient updated successfully!");
        }

    });


// ======================================
// HEALTH RECORD MANAGEMENT
// ======================================

const recordModal = document.getElementById("recordModal");
const recordForm = document.getElementById("recordForm");
const recordPatient = document.getElementById("recordPatient");

// Open Record Modal
document.getElementById("addRecordBtn")
    .addEventListener("click", () => {

        if (patients.length === 0) {

            alert("Please register a patient first.");
            return;
        }

        recordForm.reset();

        recordPatient.innerHTML = '<option value="">Choose Patient</option>';

        patients.forEach(patient => {

            const option = document.createElement("option");

            option.value = patient.id;
            option.textContent = patient.name + " (" + patient.id + ")";

            recordPatient.appendChild(option);
        });

        recordModal.classList.add("show");
    });

// Close Record Modal
function closeRecordModal() {
    recordModal.classList.remove("show");
}

document.getElementById("closeRecordModal")
    .addEventListener("click", closeRecordModal);

document.getElementById("cancelRecord")
    .addEventListener("click", closeRecordModal);

recordModal.addEventListener("click", event => {

    if (event.target === recordModal) {
        closeRecordModal();
    }

});

// Save Health Record
recordForm.addEventListener("submit", event => {

    event.preventDefault();

    const patientID = recordPatient.value;

    const patient = patients.find(p => p.id === patientID);

    if (!patient) {

        alert("Please select a valid patient.");
        return;
    }

    const systolic = Number(document.getElementById("systolic").value);
    const diastolic = Number(document.getElementById("diastolic").value);
    const heartRate = Number(document.getElementById("heartRate").value);
    const temperature = Number(document.getElementById("temperature").value);
    const weight = Number(document.getElementById("weight").value);
    const height = Number(document.getElementById("height").value);

    if (
        !Number.isFinite(systolic) || systolic < 50 || systolic > 300 ||
        !Number.isFinite(diastolic) || diastolic < 30 || diastolic > 200 ||
        !Number.isFinite(heartRate) || heartRate < 20 || heartRate > 250 ||
        !Number.isFinite(temperature) || temperature < 25 || temperature > 45 ||
        !Number.isFinite(weight) || weight <= 0 || weight > 500 ||
        !Number.isFinite(height) || height <= 0 || height > 300
    ) {

        alert("Please enter valid health measurements.");
        return;
    }

    const bmi = weight / ((height / 100) ** 2);

    const record = {

        id: "REC-" + Date.now(),
        patientId: patient.id,
        patientName: patient.name,

        systolic,
        diastolic,
        heartRate,
        temperature,
        weight,
        height,

        bmi: Number(bmi.toFixed(1)),

        date: new Date().toISOString()

    };

    records.push(record);

    saveData();

    renderRecords();
    updateDashboard();
    updateChart();

    closeRecordModal();
    recordForm.reset();

    alert("Health record saved successfully!");

});


// ======================================
// BMI CATEGORY
// ======================================

function renderRecords() {

    const table = document.getElementById("recordTable");

    table.innerHTML = "";

    let filteredRecords = [...records].reverse();

    // Apply Date Filter
    if (selectedRecordDate) {

        filteredRecords = filteredRecords.filter(record => {

            return getLocalDateString(record.date) === selectedRecordDate;

        });

    }

    // No Records
    if (filteredRecords.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">
                    No health records found.
                </td>
            </tr>
        `;

        return;
    }

    // Display Records
    filteredRecords.forEach(record => {

        const row = document.createElement("tr");

        const date = new Date(record.date).toLocaleDateString();

        const category = getBMICategory(record.bmi);

        row.innerHTML = `
            <td>${escapeHTML(record.patientName)}</td>
            <td>${escapeHTML(record.systolic)}/${escapeHTML(record.diastolic)} mmHg</td>
            <td>${escapeHTML(record.heartRate)} BPM</td>
            <td>${escapeHTML(record.temperature)} °C</td>
            <td>${escapeHTML(record.bmi)}</td>
            <td>
                <span class="bmi-badge ${category.toLowerCase()}">
                    ${category}
                </span>
            </td>
            <td>${date}</td>
        `;

        table.appendChild(row);

    });

}


// ======================================
// DATE FILTER
// ======================================

const recordDateFilter = document.getElementById("recordDateFilter");

const clearDateFilter = document.getElementById("clearDateFilter");

// Select Date
recordDateFilter.addEventListener("change", function () {

    selectedRecordDate = this.value;

    renderRecords();

});

// Clear Filter
clearDateFilter.addEventListener("click", function () {

    selectedRecordDate = "";

    recordDateFilter.value = "";

    renderRecords();

});


// ======================================
// DASHBOARD STATISTICS
// ======================================

function updateDashboard() {

    document.getElementById("totalPatients").textContent = patients.length;

    document.getElementById("totalRecords").textContent = records.length;

    const averageBMI = records.length > 0
        ? records.reduce((total, record) => total + record.bmi, 0) / records.length
        : 0;

    document.getElementById("averageBMI").textContent = averageBMI.toFixed(1);

    const today = new Date().toDateString();

    const todayRecords = records.filter(record =>
        new Date(record.date).toDateString() === today
    );

    document.getElementById("recentRecords").textContent = todayRecords.length;

}


// ======================================
// HEALTH ANALYTICS CHART
// ======================================

function updateChart() {

    const canvas = document.getElementById("healthChart");

    if (!canvas || typeof Chart === "undefined") return;

    const labels = records.slice(-7).map(record =>
        record.patientName
    );

    const heartRates = records.slice(-7).map(record =>
        record.heartRate
    );

    if (healthChart) {
        healthChart.destroy();
    }

    healthChart = new Chart(canvas, {

        type: "line",

        data: {

            labels: labels,

            datasets: [{

                label: "Heart Rate (BPM)",

                data: heartRates,

                borderColor: "#2563eb",

                backgroundColor: "rgba(37,99,235,0.12)",

                fill: true,

                tension: 0.4,

                pointRadius: 5

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: true
                }

            },

            scales: {

                y: {
                    beginAtZero: false
                }

            }

        }

    });

}


// ======================================
// EXPORT HEALTH RECORDS TO CSV
// ======================================

// Escape CSV cells and neutralize spreadsheet formula injection in text fields.
function escapeCSVValue(value, protectFormula = false) {

    let text = String(value ?? "");

    if (protectFormula && /^[\u0000-\u0020]*[=+\-@]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

function exportRecordsToCSV() {

    if (records.length === 0) {

        alert("No health records available to export.");
        return;
    }

    const headers = [

        "Patient Name",
        "Systolic BP",
        "Diastolic BP",
        "Heart Rate",
        "Temperature",
        "Weight",
        "Height",
        "BMI",
        "BMI Category",
        "Date"

    ];

    const rows = records.map(record => [

        { value: record.patientName, protectFormula: true },
        { value: record.systolic },
        { value: record.diastolic },
        { value: record.heartRate },
        { value: record.temperature },
        { value: record.weight },
        { value: record.height },
        { value: record.bmi },
        { value: getBMICategory(Number(record.bmi)) },
        { value: new Date(record.date).toLocaleDateString() }

    ]);

    const csvContent = [

        headers.map(value => escapeCSVValue(value)),

        ...rows.map(row => row.map(cell =>
            escapeCSVValue(cell.value, cell.protectFormula === true)
        ))

    ].map(row => row.join(",")).join("\n");

    const blob = new Blob(

        ["\uFEFF" + csvContent],

        { type: "text/csv;charset=utf-8;" }

    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "HealthTrack_Health_Records.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    alert("Health records exported successfully!");

}

document.getElementById("exportRecordsBtn")
    .addEventListener("click", exportRecordsToCSV);


// ======================================
// PRINT HEALTH RECORDS REPORT
// ======================================

function printHealthReport() {

    if (records.length === 0) {

        alert("No health records available to print.");
        return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {

        alert("Please allow pop-ups to print the report.");
        return;
    }

    // Prevent the opened print window from accessing this page through window.opener.
    try {
        printWindow.opener = null;
    } catch (error) {
        console.warn("Could not reset print window opener:", error);
    }

    const tableRows = [...records].reverse().map(record => `

        <tr>

            <td>${escapeHTML(record.patientName)}</td>
            <td>${escapeHTML(record.systolic)}/${escapeHTML(record.diastolic)} mmHg</td>
            <td>${escapeHTML(record.heartRate)} BPM</td>
            <td>${escapeHTML(record.temperature)} °C</td>
            <td>${escapeHTML(record.weight)} kg</td>
            <td>${escapeHTML(record.height)} cm</td>
            <td>${escapeHTML(record.bmi)}</td>
            <td>${escapeHTML(getBMICategory(Number(record.bmi)))}</td>
            <td>${escapeHTML(new Date(record.date).toLocaleDateString())}</td>

        </tr>

    `).join("");

    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>HealthTrack - Health Report</title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    padding: 25px;
                    color: #333;
                }

                h1 {
                    color: #2563eb;
                    text-align: center;
                }

                p {
                    text-align: center;
                    color: #666;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 25px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: center;
                    font-size: 12px;
                }

                th {
                    background: #2563eb;
                    color: white;
                }

                tr:nth-child(even) {
                    background: #f2f2f2;
                }

                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                }

                @media print {

                    body {
                        padding: 0;
                    }

                }

            </style>

        </head>

        <body>

            <h1>HealthTrack</h1>

            <p>Personal Health Analytics Report</p>

            <p>Generated Date: ${new Date().toLocaleDateString()}</p>

            <h3>Total Health Records: ${records.length}</h3>

            <table>

                <thead>

                    <tr>

                        <th>Patient</th>
                        <th>Blood Pressure</th>
                        <th>Heart Rate</th>
                        <th>Temperature</th>
                        <th>Weight</th>
                        <th>Height</th>
                        <th>BMI</th>
                        <th>BMI Category</th>
                        <th>Date</th>

                    </tr>

                </thead>

                <tbody>

                    ${tableRows}

                </tbody>

            </table>

            <div class="footer">

                <p>© 2026 HealthTrack | Educational Project</p>

            </div>

            <script>

                window.onload = function() {
                    window.print();
                };

            <\/script>

        </body>

        </html>

    `);

    printWindow.document.close();

}

document.getElementById("printRecordsBtn")
    .addEventListener("click", printHealthReport);


// ======================================
// INITIALIZE APPLICATION
// ======================================

function initializeApp() {

    renderPatients();

    renderRecords();

    updateDashboard();

    updateChart();

}

initializeApp();