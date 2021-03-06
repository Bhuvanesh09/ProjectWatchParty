/* global $ */

let myName;
chrome.storage.local.get("username", (res) => {
    myName = res.username;
});

const chatService = (function () {
    $("#empty-chat").hide();
    $("#group-message-holder").hide();
    $("#loading-message-container").hide();
    $("#send-message-spinner").hide();

    const messageArray = [];

    if (messageArray.length < 1) {
        $("#empty-chat").show();
        $("#group-message-holder").hide();
    } else {
        $("#group-message-holder").show();
    }

    return {
        addMessage(messageData) {
            messageArray.push(messageData);
        },
        fetchMessages() {
            $.each(messageArray, function (index, value) {
                let messageList;

                if (value.username !== "self") {
                    messageList = `
                    <div class="received-chats old-chats">
                    <div class="received-chats-img">
                        <img src="../assets/dp/${findNumber(value.username)}-poke.svg" alt="Avatar" class="avatar">
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
                    `;
                } else {
                    messageList = `
                    <div class="outgoing-chats old-chats">
                        <div class="outgoing-chats-msg">
                            <p>${value.message}</p>
                        </div>
                        <div class="outgoing-chats-img">
                            <img src="../assets/dp/${findNumber(myName)}-poke.svg" alt="" class="avatar">
                        </div>
                    </div>
`;
                }

                $("#group-message-holder").append(messageList);
            });
            this.scrollToBottom();
        },
        sendMessage(message) {
            $("#send-message-spinner").show();

            chrome.runtime.sendMessage({
                action: "textMessageSending",
                messageString: message.message,
            }, function (_status) {
                if (chrome.runtime.lastError) {
                    console.log("ERROR", chrome.runtime.lastError);
                } else {
                    // statusElm.innerText = status;
                    // Messaage send successfully
                }
            });
            messageArray.push(message);
        },
        onMessageReceived() {
            $("#empty-chat").hide();
            $("#group-message-holder").show();
            $("#send-message-spinner").hide();

            $.each(messageArray, function (index, value) {
                let messageList;

                if (value.username !== "self") {
                    messageList = `
                    <div class="received-chats old-chats">
                    <div class="received-chats-img">
                        <img src="../assets/dp/${findNumber(value.username)}-poke.svg" alt="Avatar" class="avatar">
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
                    `;
                } else {
                    messageList = `
                    <div class="outgoing-chats ongoing old-chats">
                        <div class="outgoing-chats-msg">
                            <p>${value.message}</p>
                        </div>
                        <div class="outgoing-chats-img">
                            <img src="../assets/dp/${findNumber(myName)}-poke.svg" alt="" class="avatar">
                        </div>
                    </div>
`;
                }
                $("#group-message-holder").append(messageList);
            });
            this.scrollToBottom();
        },
        scrollToBottom() {
            const chat = document.getElementById("msg-page");
            chat.scrollTo(0, chat.scrollHeight + 30);
        },
    };
}());
