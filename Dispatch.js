(function initDispatchPage() {
  const form = document.getElementById('dispatchForm');
  const godownSelect = document.getElementById('lrOnGodown');
  const vehicleSelect = document.getElementById('lrOnVehicle');
  const moveToVehicleBtn = document.getElementById('moveToVehicle');
  const moveToGodownBtn = document.getElementById('moveToGodown');

  if (!form || !godownSelect || !vehicleSelect || !moveToVehicleBtn || !moveToGodownBtn) {
    return;
  }

  const dispatchFields = [
    'dispatchNo',
    'dispatchMethod',
    'branch',
    'vehicleNo',
    'driverName',
    'dispatchDate'
  ];

  function getBookingLRNumbers() {
    const bookingKeys = ['bookingLRNumbers', 'bookingLRs', 'bookingData'];

    for (const key of bookingKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const numbers = extractLRNumbers(parsed);
        if (numbers.length > 0) {
          return numbers;
        }
      } catch {
        if (typeof raw === 'string' && raw.trim()) {
          return raw.split(',').map((lr) => lr.trim()).filter(Boolean);
        }
      }
    }

    return [];
  }

  function extractLRNumbers(source) {
    if (!source) return [];

    if (Array.isArray(source)) {
      return source
        .map((item) => {
          if (typeof item === 'string' || typeof item === 'number') return String(item);
          if (item && (item.lrNumber || item.lrNo || item.LRNumber)) {
            return String(item.lrNumber || item.lrNo || item.LRNumber);
          }
          return '';
        })
        .map((lr) => lr.trim())
        .filter(Boolean);
    }

    if (typeof source === 'object') {
      if (Array.isArray(source.lrNumbers)) {
        return extractLRNumbers(source.lrNumbers);
      }
      if (Array.isArray(source.items)) {
        return extractLRNumbers(source.items);
      }
    }

    return [];
  }

  function addOptions(selectElement, values) {
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function moveSelected(from, to) {
    const selected = Array.from(from.selectedOptions);
    selected.forEach((option) => to.appendChild(option));
  }

  function getAllOptionValues(selectElement) {
    return Array.from(selectElement.options).map((option) => option.value);
  }

  function getDispatchDetails() {
    return dispatchFields.reduce((acc, fieldId) => {
      const el = document.getElementById(fieldId);
      acc[fieldId] = el ? el.value.trim() : '';
      return acc;
    }, {});
  }

  function validateRequiredDispatchFields(details) {
    const required = ['dispatchNo', 'dispatchMethod', 'branch'];
    return required.every((field) => details[field]);
  }

  function persistLoad() {
    const dispatchDetails = getDispatchDetails();

    if (!validateRequiredDispatchFields(dispatchDetails)) {
      alert('Please fill Dispatch No, Method, and Branch before loading.');
      return;
    }

    const lrOnVehicle = getAllOptionValues(vehicleSelect);
    if (lrOnVehicle.length === 0) {
      alert('Move at least one LR number to LR ON VEHICLE before loading.');
      return;
    }

    const payload = lrOnVehicle.map((lrNumber) => ({
      lrNumber,
      dispatch: { ...dispatchDetails },
      loadedAt: new Date().toISOString()
    }));

    const history = JSON.parse(localStorage.getItem('dispatchLoads') || '[]');
    history.push(...payload);
    localStorage.setItem('dispatchLoads', JSON.stringify(history));

    localStorage.setItem('lrOnGodown', JSON.stringify(getAllOptionValues(godownSelect)));
    localStorage.setItem('lrOnVehicle', JSON.stringify(lrOnVehicle));

    alert(`Dispatch details saved for ${lrOnVehicle.length} LR number(s) in LR ON VEHICLE.`);
  }

  const initialGodown = unique([
    ...getBookingLRNumbers(),
    ...extractLRNumbers(JSON.parse(localStorage.getItem('lrOnGodown') || '[]'))
  ]);
  const initialVehicle = unique(extractLRNumbers(JSON.parse(localStorage.getItem('lrOnVehicle') || '[]')));

  const vehicleSet = new Set(initialVehicle);
  addOptions(godownSelect, initialGodown.filter((lr) => !vehicleSet.has(lr)));
  addOptions(vehicleSelect, initialVehicle);

  moveToVehicleBtn.addEventListener('click', () => moveSelected(godownSelect, vehicleSelect));
  moveToGodownBtn.addEventListener('click', () => moveSelected(vehicleSelect, godownSelect));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    persistLoad();
  });
})();
