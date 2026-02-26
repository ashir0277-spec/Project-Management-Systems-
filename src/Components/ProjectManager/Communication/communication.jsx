import React, { useState } from 'react';

const Communication = () => {
  const [selectedChat, setSelectedChat] = useState(0);
  const [messageInput, setMessageInput] = useState('');

  const chats = [
    { 
      name: 'Project Team A', 
      lastMessage: 'Meeting at 3 PM today', 
      time: '10:30 AM', 
      unread: 3,
      type: 'group'
    },
    { 
      name: 'Alice Johnson', 
      lastMessage: 'Can you review the design?', 
      time: '9:15 AM', 
      unread: 1,
      type: 'direct'
    },
    { 
      name: 'Client - TechCorp', 
      lastMessage: 'Thanks for the update!', 
      time: 'Yesterday', 
      unread: 0,
      type: 'client'
    },
    { 
      name: 'Bob Smith', 
      lastMessage: 'Code review completed', 
      time: 'Yesterday', 
      unread: 0,
      type: 'direct'
    },
    { 
      name: 'Marketing Team', 
      lastMessage: 'Campaign analytics ready', 
      time: '2 days ago', 
      unread: 0,
      type: 'group'
    },
  ];

  const messages = [
    { sender: 'Alice Johnson', message: 'Hey team! Ready for the meeting?', time: '10:25 AM', isMine: false },
    { sender: 'You', message: "Yes, I'll be there in 5 minutes", time: '10:27 AM', isMine: true },
    { sender: 'Bob Smith', message: 'Same here, just finishing up some code', time: '10:28 AM', isMine: false },
    { sender: 'Alice Johnson', message: 'Great! See you all soon 👍', time: '10:29 AM', isMine: false },
    { sender: 'You', message: 'Should I bring the design mockups?', time: '10:29 AM', isMine: true },
    { sender: 'Alice Johnson', message: 'Yes please! That would be helpful', time: '10:30 AM', isMine: false },
  ];

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      // Handle message sending logic here
      setMessageInput('');
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#f8fafc] mb-2">Communication</h1>
        <p className="text-[#94a3b8]">Stay connected with your team and clients</p>
      </div>

      {/* Chat Interface */}
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] overflow-hidden h-[600px] flex">
        {/* Chat List */}
        <div className="w-80 border-r border-[#334155] flex flex-col">
          <div className="p-4 border-b border-[#334155]">
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-[#f8fafc] placeholder-[#64748b] focus:border-[#00d4ff] focus:outline-none text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.map((chat, index) => (
              <div
                key={index}
                onClick={() => setSelectedChat(index)}
                className={`p-4 border-b border-[#334155] cursor-pointer transition-all duration-300 ${
                  selectedChat === index
                    ? 'bg-[rgba(0,212,255,0.1)] border-l-4 border-l-[#00d4ff]'
                    : 'hover:bg-[rgba(0,212,255,0.05)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center text-white font-bold flex-shrink-0">
                    {chat.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-[#f8fafc] font-semibold text-sm truncate">{chat.name}</h4>
                      <span className="text-[#94a3b8] text-xs ml-2">{chat.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[#94a3b8] text-sm truncate flex-1">{chat.lastMessage}</p>
                      {chat.unread > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 bg-[#00d4ff] text-white text-xs rounded-full flex items-center justify-center font-semibold px-1.5">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#334155] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center text-white font-bold">
                {chats[selectedChat].name[0]}
              </div>
              <div>
                <h3 className="text-[#f8fafc] font-bold text-lg">{chats[selectedChat].name}</h3>
                <p className="text-[#94a3b8] text-xs">
                  {chats[selectedChat].type === 'group' ? 'Group Chat' : 'Direct Message'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-[rgba(0,212,255,0.1)] rounded-lg transition-all duration-300">
                <span className="text-xl">📞</span>
              </button>
              <button className="p-2 hover:bg-[rgba(0,212,255,0.1)] rounded-lg transition-all duration-300">
                <span className="text-xl">📹</span>
              </button>
              <button className="p-2 hover:bg-[rgba(0,212,255,0.1)] rounded-lg transition-all duration-300">
                <span className="text-xl">ℹ️</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${msg.isMine ? 'order-2' : 'order-1'}`}>
                  {!msg.isMine && <div className="text-[#94a3b8] text-xs mb-1">{msg.sender}</div>}
                  <div
                    className={`p-3 rounded-lg ${
                      msg.isMine
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white rounded-br-none'
                        : 'bg-[#0f172a] text-[#f8fafc] rounded-bl-none border border-[#334155]'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                  </div>
                  <div className={`text-[#64748b] text-xs mt-1 ${msg.isMine ? 'text-right' : 'text-left'}`}>
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-[#334155]">
            <div className="flex gap-3">
              <button className="p-3 hover:bg-[rgba(0,212,255,0.1)] rounded-lg transition-all duration-300">
                <span className="text-xl">📎</span>
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-lg text-[#f8fafc] placeholder-[#64748b] focus:border-[#00d4ff] focus:outline-none"
              />
              <button className="p-3 hover:bg-[rgba(0,212,255,0.1)] rounded-lg transition-all duration-300">
                <span className="text-xl">😊</span>
              </button>
              <button
                onClick={handleSendMessage}
                className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white font-semibold rounded-lg hover:shadow-[0_4px_20px_rgba(0,212,255,0.4)] transition-all duration-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Communication;