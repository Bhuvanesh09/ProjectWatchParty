$(document).ready(function() {
    chatService.fetchMessages();

    
    $('#message-form').submit(function(e) {    
        e.preventDefault(); 
        let message = $('#input-text').val(); 

        let text = { 
            username: "self",
            message 
        } 

        $('.old-chats').remove();

        chatService.sendMessage(text);

        chatService.onMessageReceived();
        
        $('#message-form').trigger('reset');
    });
});
chrome.runtime.onMessage.addListener(function ({
        action,
        ...others
    }, _sender, sendResponse) {

    switch(action){
        case "textMessageReceiving":
            addMessageToChatService(others);
            break;
        default:
            //console.log("Unknown action, please help")
    }
    return false;
});

function addMessageToChatService(data) {
    $('.old-chats').remove();
    chatService.addMessage({
                            username: data.senderName,
                            message: data.messageString
                            })    
    chatService.onMessageReceived();
}




    
