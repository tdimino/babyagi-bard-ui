import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Message, MessageStatus, SelectItem, UserSettings } from '@/types';
import { Input } from './Input';
import AgentMessage from './AgentMessage';
import { AgentParameter, iterationList, models } from './AgentParameter';
import { ProjectTile } from './ProjectTile';
import { AgentMessageHeader } from './AgentMessageHeader';
import { loadingAgentMessage } from '../../utils';
import { BabyAGI } from '../../agents/babyagi/agent';

export const Agent: FC = () => {
  const [model, setModel] = useState<SelectItem>(models[1]);
  const [iterations, setIterations] = useState<SelectItem>(iterationList[0]);
  const [objective, setObjective] = useState<string>('');
  const [firstTask, setFirstTask] = useState<string>('Develop a task list');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<MessageStatus>('none');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [agent, setAgent] = useState<BabyAGI | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const messageHandler = (message: Message) => {
    setMessages((messages) => [...messages, message]);
  };

  const inputHandler = (value: string) => {
    setObjective(value);
  };

  const startHandler = () => {
    if (!availableUserSettings()) {
      alert(
        'Please set up your OpenAI API key and Pinecone config from the settings menu.',
      );
      return;
    }

    setMessages([]);
    setIsStreaming(true);

    const agent = new BabyAGI(
      objective,
      model.id,
      Number(iterations.id),
      firstTask,
      messageHandler,
      setStatus,
      () => {
        setAgent(null);
        setIsStreaming(false);
      },
    );
    setAgent(agent);
    agent.run();
  };

  const stopHandler = () => {
    console.log('Stop streaming');
    setIsStreaming(false);
    agent?.stop();
  };

  const clearHandler = () => {
    setMessages([]);
  };

  const availableUserSettings = () => {
    const useEnvValues = process.env.NEXT_PUBLIC_USE_ENV_VALUES;
    if (useEnvValues === 'true') {
      return true;
    }

    const userSettings = localStorage.getItem('userSettings');
    if (userSettings) {
      const { openAIApiKey, pineconeApiKey, pineconeEnvironment } = JSON.parse(
        userSettings,
      ) as UserSettings;
      if (
        openAIApiKey &&
        openAIApiKey?.length > 0 &&
        pineconeApiKey &&
        pineconeApiKey?.length > 0 &&
        pineconeEnvironment &&
        pineconeEnvironment?.length > 0
      ) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="overflow-none relative flex-1 bg-white dark:bg-[#343541]">
      {messages.length === 0 ? (
        <>
          <AgentParameter
            model={model}
            setModel={setModel}
            iterations={iterations}
            setIterations={setIterations}
            firstTask={firstTask}
            setFirstTask={setFirstTask}
          />
          <div className="h-[calc(100vh-317px)]">
            <ProjectTile />
          </div>
        </>
      ) : (
        <div className="max-h-full overflow-scroll">
          <AgentMessageHeader model={model} iterations={iterations} />
          {messages.map((message, index) => (
            <AgentMessage key={index} message={message} />
          ))}
          {isStreaming && (
            <AgentMessage message={loadingAgentMessage(status)} />
          )}
          <div
            className="h-[162px] bg-white dark:bg-[#343541]"
            ref={messagesEndRef}
          />
        </div>
      )}
      <Input
        value={objective}
        onChange={inputHandler}
        onStart={startHandler}
        onStop={stopHandler}
        onClear={clearHandler}
        isStreaming={isStreaming}
        hasMessages={messages.length > 0}
      />
    </div>
  );
};
