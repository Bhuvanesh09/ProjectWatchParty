const chatService = function() {

    $('#empty-chat').hide();
    $('#group-message-holder').hide();
    $('#loading-message-container').hide();
    $('#send-message-spinner').hide();


    let messageArray = [
        //{
            //username: "oluyemi",
            //message: "This is a new message"
        //},
        //{
            //username: "Demo",
            //message: "This is a new for demo"
        //},
        //{
            //username: "sample",
            //message: "Another reply from me"
        //}
    ];


    if (messageArray.length < 1) {
        $('#empty-chat').show();
        $('#group-message-holder').hide();
    } else {
        $('#group-message-holder').show();
    }
    
    return {
        addMessage: function(messageData) {
            messageArray.push(messageData);
        },
        fetchMessages: function() {
            $.each(messageArray, function(index, value) {
                let messageList;

                if (value.username !== "oluyemi") {
                    messageList = `
                    <div class="received-chats old-chats">
                    <div class="received-chats-img">
                        <img src="../assets/pp.png" alt="Avatar" class="avatar">
                    </div>

                    <div class="received-msg">
                        <div class="received-msg-inbox">
                            <p>
                                <span id="message-sender-id">${value.username}</span><br />
                                ${value.message}
                            </p>
                        </div>
                    </div>
                </div>                    
                    `
                } else {
                    messageList = `
                    <div class="outgoing-chats old-chats">
                        <div class="outgoing-chats-msg">
                            <p>${value.message}</p>
                        </div>
                        <div class="outgoing-chats-img">
                            <img src="../assets/pp.png" alt="" class="avatar">
                        </div>
                    </div>
`
                }

                $('#group-message-holder').append(messageList);
            });
            this.scrollToBottom();
        },
        sendMessage: function(message){
            $('#send-message-spinner').show();

            chrome.runtime.sendMessage({
                action: "textMessageSending",
                message,
            }, function (status) {
                if (chrome.runtime.lastError) {
                    console.log("ERROR", chrome.runtime.lastError);
                } else {
                    //statusElm.innerText = status;
                    //Messaage send successfully
                }
            });
            messageArray.push(message);
        },
        onMessageReceived: function() {
            $('#empty-chat').hide();
            $('#group-message-holder').show();
            $('#send-message-spinner').hide();

            $.each(messageArray, function(index, value) {
                let messageList;

                if (value.username !== "oluyemi") {
                    messageList = `
                    <div class="received-chats old-chats">
                    <div class="received-chats-img">
                        <img src="../assets/pp.png" alt="Avatar" class="avatar">
                    </div>

                    <div class="received-msg">
                        <div class="received-msg-inbox">
                            <p>
                                <span id="message-sender-id">${value.username}</span><br />
                                ${value.message}
                            </p>
                        </div>
                    </div>
                </div>                    
                    `
                } else {
                    messageList = `
                    <div class="outgoing-chats ongoing old-chats">
                        <div class="outgoing-chats-msg">
                            <p>${value.message}</p>
                        </div>
                        <div class="outgoing-chats-img">
                            <img src="../assets/pp.png" alt="" class="avatar">
                        </div>
                    </div>
`
                }
                $('#group-message-holder').append(messageList);
            });
            this.scrollToBottom();
        },
        scrollToBottom() {
            const chat = document.getElementById("msg-page");
            chat.scrollTo(0, chat.scrollHeight + 30);
        }
    }
}();

