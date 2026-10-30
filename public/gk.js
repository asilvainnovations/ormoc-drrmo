// Fetch data from local JSON file
fetch('data.json")
    // Convert response to JSON
    .then(function(response) {
        return response.json();
    })
    // Process JSON data
    .then(function(data) {
        // Insert overview text
        document.getElementById("overviewContent").innerText = data.overview;
        // Get criteria container
        var criteriaContainer = document.getElementById("criteriaContent");
        // Loop through criteria list
        data.criteria.forEach(function(item) {
            // Create paragraph element
            var paragraphElement = document.createElement("p");
            // Set text content
            paragraphElement.innerText = item;
            // Append to container
            criteriaContainer.appendChild(paragraphElement);
        });
        // Get scoring table element
        var scoringTable = document.getElementById("scoringTable");
        // Create table header row
        var headerRow = document.createElement("tr");
        // Create dimension header
        var dimensionHeader = document.createElement("th");
        dimensionHeader.innerText = "Dimension";
        // Create weight header
        var weightHeader = document.createElement("th");
        weightHeader.innerText = "Weight";
        // Append headers
        headerRow.appendChild(dimensionHeader);
        headerRow.appendChild(weightHeader);
        // Append header row to table
        scoringTable.appendChild(headerRow);
        // Loop through scoring data
        data.scoring.forEach(function(scoreItem) {
            // Create table row
            var rowElement = document.createElement("tr");
            // Create dimension cell
            var dimensionCell = document.createElement("td");
            dimensionCell.innerText = scoreItem.dimension;
            // Create weight cell
            var weightCell = document.createElement("td");
            weightCell.innerText = scoreItem.weight;
            // Append cells to row
            rowElement.appendChild(dimensionCell);
            rowElement.appendChild(weightCell);
            // Append row to table
            scoringTable.appendChild(rowElement);
        });
    });
