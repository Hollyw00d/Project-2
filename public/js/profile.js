$(document).ready(function () {
    $('#addItem').on('click', function (event) {
        event.preventDefault();
        const itemInfo = {
            itemName: $('#itemName').val().trim(),
            itemImage: $('#itemImage').val().trim(),
            itemDescription: $('#itemDesc').val().trim(),
            itemCategory: $('#itemCategory').val().trim(),
            groupAvailableTo: $('#availableTo').val().trim(),
        };
        $.ajax('/api/items', {
            type: 'POST',
            data: itemInfo
        }).then(function (/*response*/) {
            location.reload();
        });
    });
    $('#addGroup').on('click', function (event) {
        event.preventDefault();
        const groupInfo = {
            groupName: $('#groupName').val().trim(),
            groupDescription: $('#groupDescription').val().trim()
        };
        $.ajax('/api/groups', {
            type: 'POST',
            data: groupInfo
        }).then(function (/*response*/) {
            location.reload();
        });
    });

    $('.confirmRequest').on('click', function (event) {
        event.preventDefault();
        // console.log(requestInfo);
        let requestId = event.target.dataset.requestid;
        console.log(event);
        console.log(requestId);
        let requestInfo = {
            requestId: requestId,
            confirmed: true,
            denied: false
        };
        $.ajax('/api/requests', {
            type: 'PUT',
            data: requestInfo
        }).then(function (/*response*/) {
            location.reload();
        });
    });

    $('.denyRequest').on('click', function (event) {
        event.preventDefault();
        // console.log(requestInfo);
        let requestId = event.target.dataset.requestid;
        console.log(event);
        console.log(requestId);
        let requestInfo = {
            requestId: requestId,
            confirmed: true,
            denied: true
        };
        $.ajax('/api/requests', {
            type: 'PUT',
            data: requestInfo
        }).then(function (/*response*/) {
            location.reload();
        });
    });
});