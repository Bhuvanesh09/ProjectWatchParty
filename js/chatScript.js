/* global $, chatService */

$(document).ready(function () {
    chatService.fetchMessages();

    $("#message-form").submit(function (e) {
        e.preventDefault();
        const message = $("#input-text").val(),

            text = {
                username: "self",
                message,
            };

        $(".old-chats").remove();

        chatService.sendMessage(text);

        chatService.onMessageReceived();

        $("#message-form").trigger("reset");
    });
});
chrome.runtime.onMessage.addListener(function ({
    action,
    ...others
}, _sender, _sendResponse) {
    switch (action) {
    case "textMessageReceiving":
        addMessageToChatService(others);
        break;
    default:
            // console.log("Unknown action, please help")
    }
    return false;
});

function addMessageToChatService(data) {
    $(".old-chats").remove();
    chatService.addMessage({
        username: data.senderName,
        message: data.messageString,
    });
    chatService.onMessageReceived();
}

window.addEventListener("load", function () {
    chrome.runtime.sendMessage({
        action: "populateChatWindow",
    });
});
