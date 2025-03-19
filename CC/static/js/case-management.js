$(document).ready(function() {
  // Initialize DataTables for cases
  function initializeDataTable(casesData) {
    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#casesTable')) {
      $('#casesTable').DataTable().destroy();
    }
    
    const table = $('#casesTable').DataTable({
      data: casesData,
      columns: [
        { data: 'title', title: 'Case Subject' },
        { 
          data: 'priority', 
          title: 'Priority',
          render: function(data) {
            return `<span class="priority-${data.toLowerCase()}">${data}</span>`;
          }
        },
        { 
          data: 'status', 
          title: 'Status',
          render: function(data) {
            return `<span class="status-${data.toLowerCase().replace(' ', '-')}">${data}</span>`;
          }
        },
        { data: 'created_at', title: 'Created Date' },
        { data: 'description', title: 'Description' }
      ],
      responsive: true,
      pageLength: 10,
      lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
      order: [[3, 'desc']],
      language: {
        search: 'Filter cases:',
        lengthMenu: 'Show _MENU_ cases per page'
      },
      dom: '<"top"lf>rt<"bottom"ip><"clear">',
      rowCallback: function(row, data) {
        $(row).css('cursor', 'pointer');
        $(row).on('click', function() {
          showCaseDetailsModal(data);
        });
      }
    });
    
    return table;
  }

  // Function to show case details modal with progress updates
  function showCaseDetailsModal(caseData) {
    const modalHtml = `
      <div id="caseDetailsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-900">Case Details</h2>
            <button id="closeCaseDetailsModal" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Case Subject</label>
                <p class="mt-1 p-2 w-full rounded-md bg-gray-50">${caseData.title}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Priority</label>
                <p class="mt-1 p-2 w-full rounded-md bg-gray-50 priority-${caseData.priority.toLowerCase()}">${caseData.priority}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Status</label>
                <p class="mt-1 p-2 w-full rounded-md bg-gray-50 status-${caseData.status.toLowerCase().replace(' ', '-')}">${caseData.status}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Created Date</label>
                <p class="mt-1 p-2 w-full rounded-md bg-gray-50">${caseData.created_at}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Description</label>
                <p class="mt-1 p-2 w-full rounded-md bg-gray-50">${caseData.description}</p>
              </div>
            </div>
            <div class="space-y-4">
              <div class="bg-gray-50 rounded-lg p-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Progress Updates</h3>
                <div id="progressUpdates" class="space-y-4 max-h-[400px] overflow-y-auto"></div>
                <div class="mt-4">
                  <form id="updateForm" class="space-y-4">
                    <div>
                      <label for="updateText" class="block text-sm font-medium text-gray-700">Add Update</label>
                      <div id="updateText" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200"></div>
                    </div>
                    <div>
                      <label for="newStatus" class="block text-sm font-medium text-gray-700">Update Status (Optional)</label>
                      <select id="newStatus" name="newStatus" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200">
                        <option value="">No status change</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <button type="submit" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                      Add Update
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end mt-6">
            <button id="closeCaseDetailsModalBottom" class="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors">Close</button>
          </div>
        </div>
      </div>
    `;

    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Close modal event listeners
    const closeCaseDetailsModal = document.getElementById('closeCaseDetailsModal');
    const closeCaseDetailsModalBottom = document.getElementById('closeCaseDetailsModalBottom');
    const caseDetailsModal = document.getElementById('caseDetailsModal');
    const updateForm = document.getElementById('updateForm');

    function closeModal() {
      if (caseDetailsModal) {
        caseDetailsModal.remove();
      }
    }

    closeCaseDetailsModal.addEventListener('click', closeModal);
    closeCaseDetailsModalBottom.addEventListener('click', closeModal);

    // Load existing updates
    loadProgressUpdates(caseData.id);

    // Handle form submission
    // Initialize Quill editor
    const quill = new Quill('#updateText', {
      theme: 'snow',
      placeholder: 'Enter your update here...',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'indent': '-1'}, { 'indent': '+1' }],
          ['link'],
          ['clean']
        ]
      }
    });
    
    updateForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const updateText = quill.root.innerHTML;
      const newStatus = document.getElementById('newStatus').value;

      if (!updateText.trim() || updateText === '<p><br></p>') {
        return;
      }

      const updateData = {
        case_id: caseData.id,
        text: updateText,
        new_status: newStatus,
        timestamp: new Date().toISOString()
      };

      fetch('/add-case-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          document.getElementById('updateText').value = '';
          document.getElementById('newStatus').value = '';
          loadProgressUpdates(caseData.id);
          if (newStatus) {
            fetchCasesData(); // Refresh the main table if status was updated
          }
        }
      })
      .catch(error => console.error('Error adding update:', error));
    });
  }

  function loadProgressUpdates(caseId) {
    console.log('Loading updates for case:', caseId); // Debug log
    fetch(`/get-case-updates/${caseId}`)
      .then(response => {
        console.log('Response status:', response.status); // Debug log
        return response.json();
      })
      .then(data => {
        console.log('Full updates data:', data); // Detailed debug log
        const updatesContainer = document.getElementById('progressUpdates');
        
        if (!updatesContainer) {
          console.error('Updates container not found');
          return;
        }
        
        if (data.status === 'success') {
          console.log('Updates count:', data.updates.length); // Debug log
          if (data.updates.length === 0) {
            updatesContainer.innerHTML = '<p class="text-gray-500 text-center">No updates yet</p>';
          } else {
            updatesContainer.innerHTML = data.updates.map(update => {
              console.log('Processing update:', update); // Debug log for each update
              return `
              <div class="bg-white rounded-lg shadow p-4 mb-2">
                <div class="flex justify-between items-start">
                  <div class="text-gray-900 flex-grow quill-content">${update.text}</div>
                  <p class="text-gray-900 flex-grow">${update.text}</p>
                  <span class="text-sm text-gray-500 ml-2">${new Date(update.timestamp).toLocaleString()}</span>
                </div>
                ${update.new_status ? `
                  <div class="mt-2">
                    <span class="text-sm font-medium text-gray-700">Status updated to: </span>
                    <span class="status-${update.new_status.toLowerCase().replace(' ', '-')}">${update.new_status}</span>
                  </div>
                ` : ''}
                <div class="mt-2">
                  <span class="text-sm text-gray-500">By ${update.user_email}</span>
                </div>
              </div>
            `;
            }).join('');
          }
        } else {
          console.error('Failed to fetch updates:', data);
          updatesContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load updates</p>';
        }
      })
      .catch(error => {
        console.error('Error loading updates:', error);
        const updatesContainer = document.getElementById('progressUpdates');
        if (updatesContainer) {
          updatesContainer.innerHTML = '<p class="text-red-500 text-center">Error loading updates: ' + error.message + '</p>';
        }
      });
  }

  // Fetch cases data if not already present
  function fetchCasesData() {
    fetch('/get-cases')
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          document.getElementById('casesData').textContent = JSON.stringify(data.cases);
          initializeDataTable(data.cases);
        }
      })
      .catch(error => console.error('Error fetching cases:', error));
  }

  // Initialize table or fetch data
  const casesDataElement = document.getElementById('casesData');
  if (casesDataElement && casesDataElement.textContent.trim()) {
    const casesData = JSON.parse(casesDataElement.textContent);
    initializeDataTable(casesData);
  } else {
    fetchCasesData();
  }

  // New Case Button Handler
  const newCaseBtn = document.getElementById('newCaseBtn');
  if (newCaseBtn) {
    newCaseBtn.addEventListener('click', function() {
      const caseForm = document.getElementById('caseForm');
      if (caseForm) {
        // Create modal for new case form
        const modalHtml = `
          <div id="newCaseModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-900">Create New Case</h2>
                <button id="closeCaseModal" class="text-gray-500 hover:text-gray-700">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              <form id="createCaseForm" class="space-y-4">
                <div>
                  <label for="title" class="block text-sm font-medium text-gray-700">Case Subject</label>
                  <input type="text" id="title" name="title" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200">
                </div>
                <div>
                  <label for="priority" class="block text-sm font-medium text-gray-700">Priority</label>
                  <select id="priority" name="priority" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
                  <select id="status" name="status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200">
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
                  <textarea id="description" name="description" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200"></textarea>
                </div>
                <div class="flex justify-end space-x-4">
                  <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">Create Case</button>
                  <button type="button" id="cancelCaseModal" class="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `;

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Close modal event listeners
        const closeCaseModal = document.getElementById('closeCaseModal');
        const cancelCaseModal = document.getElementById('cancelCaseModal');
        const newCaseModal = document.getElementById('newCaseModal');

        function closeModal() {
          if (newCaseModal) {
            newCaseModal.remove();
          }
        }

        closeCaseModal.addEventListener('click', closeModal);
        cancelCaseModal.addEventListener('click', closeModal);

        // Form submission handler
        const createCaseForm = document.getElementById('createCaseForm');
        createCaseForm.addEventListener('submit', function(e) {
          e.preventDefault();
          const formData = new FormData(createCaseForm);
          const caseData = Object.fromEntries(formData.entries());

          fetch('/create-case', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(caseData)
          })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'success') {
              // Reload cases table
              fetchCasesData();
              // Close modal
              closeModal();
            } else {
              console.error('Case creation failed:', data);
            }
          })
          .catch(error => {
            console.error('Error creating case:', error);
          });
        });
      }
    });
  }
});

// Destroy and reinitialize DataTable to prevent reinitialization errors
function destroyAndReinitializeDataTable(casesData) {
  if ($.fn.DataTable.isDataTable('#casesTable')) {
    $('#casesTable').DataTable().destroy();
  }
  initializeDataTable(casesData);
}