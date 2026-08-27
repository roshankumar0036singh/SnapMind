'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useStickToBottom } from 'use-stick-to-bottom';
import AiResponse from './text/ai-response';
import UserMessage from './text/user-message';
import { Bot, Loader2 } from 'lucide-react';

type PropsType = {
  useChat: UseChatHelpers & {
    addToolResult: ({
      toolCallId,
      result,
    }: {
      toolCallId: string;
      result: unknown;
    }) => void;
  };
  isThinking: boolean;
};

export function RenderMessage({ useChat, isThinking }: PropsType) {
  const { messages, setMessages, reload, error } = useChat;
  const { contentRef, scrollRef } = useStickToBottom();

  useEffect(() => {
    if (error?.message.includes('Incorrect API')) {
      toast.error('Incorrect API key provided', {
        description: 'Please check your API key and try again.',
      });
    }
  }, [error]);

  return (
    <div
      className="h-full w-full overflow-y-auto custom-scrollbar px-5 pt-12 pb-6 md:px-12"
      ref={scrollRef}
    >
      <div
        className="w-full pb-20"
        ref={contentRef}
      >
        {messages.map((message, messageIdx) => {
          return (
            <div key={message.id}>
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  if (message.role === 'user') {
                    return (
                      <UserMessage
                        key={`${message.id}-${i}`}
                        message={part.text}
                        showActions={
                          // showActions is true only for the last user message
                          messages.length - 1 === messageIdx ||
                          // if ai responded it should be second to last
                          messages.length - 2 === messageIdx
                        }
                        onEdit={async (newMessage) => {
                          setMessages((prev) => {
                            return prev.map((prevMsg) => {
                              if (prevMsg.id !== message.id) return prevMsg;

                              return {
                                ...prevMsg,
                                parts: prevMsg.parts?.map((part) => ({
                                  ...part,
                                  text: newMessage,
                                })),
                              };
                            });
                          });

                          reload();
                        }}
                      />
                    );
                  }

                  return (
                    <AiResponse
                      key={`${message.id}-${i}`}
                      response={part.text}
                      annotations={message.annotations}
                    />
                  );
                }
              })}
            </div>
          );
        })}

        {isThinking && (
          <div className="w-full max-w-3xl mx-auto flex gap-3 animate-pulse px-2 mt-6">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1A1E23] border border-slate-100 dark:border-gray-800 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 px-4 py-2 rounded-full border border-slate-100 dark:border-gray-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span className="text-xs font-medium tracking-wide">
                AI is thinking...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
