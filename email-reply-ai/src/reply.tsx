import { ActionPanel, List, Action, Icon, getSelectedText, showToast, Toast, Color, AI, environment } from "@raycast/api";
import { useState, useEffect } from "react";

interface ReplyType {
  id: string;
  title: string;
  icon: Icon;
  description: string;
  length: string;
}

const replyTypes: ReplyType[] = [
  {
    id: "short",
    title: "短め",
    icon: Icon.Message,
    description: "簡潔で要点を絞った返信",
    length: "約2-3行",
  },
  {
    id: "medium",
    title: "中くらい",
    icon: Icon.Text,
    description: "適度な詳細を含む返信",
    length: "約4-6行",
  },
  {
    id: "long",
    title: "長め",
    icon: Icon.Document,
    description: "詳細で丁寧な返信",
    length: "約7-10行",
  },
];

async function generateReply(originalText: string, type: string): Promise<string> {
  if (!environment.canAccess(AI)) {
    throw new Error("Raycast AIにアクセスできません。Raycast Proが必要です。");
  }

  let prompt = "";
  const basePrompt = `以下のテキストに対して、適切な返信を生成してください。

元のテキスト：
${originalText}

要求事項：
- 必ず選択した文章と同じ言語で返信
- 内容に応じて適切な敬語レベルを選択
- 自然で読みやすい返信文を生成
- テキストの内容や文脈に応じた適切な返信スタイルを選択`;

  switch (type) {
    case "short":
      prompt = `${basePrompt}
- 簡潔で要点を絞った返信（2-3行程度に収めること）
- 核心となる返答を簡潔に表現`;
      break;
    
    case "medium":
      prompt = `${basePrompt}
- 適度な詳細を含む返信（4-6行程度に収めること）
- 元のテキストの要点に触れながら回答
- 必要に応じて理由や補足説明を含める`;
      break;
    
    case "long":
      prompt = `${basePrompt}
- 詳細で丁寧な返信（7-10行程度に収めること）
- 元のテキストに対する詳しい見解や意見を表現
- 具体例や詳細な説明を含めた充実した内容
- より丁寧で配慮のある表現を使用`;
      break;
    
    default:
      prompt = `${basePrompt}
- 一般的で適切な返信`;
  }

  try {
    const response = await AI.ask(prompt, {
      creativity: "low",
      model: AI.Model["Google_Gemini_2.5_Flash"]
    });
    return response;
  } catch (error) {
    console.error("AI生成エラー:", error);
    throw new Error("AI返信の生成に失敗しました。");
  }
}

export default function Command() {
  const [selectedText, setSelectedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [generatedReplies, setGeneratedReplies] = useState<{[key: string]: string}>({});
  const [generatingReply, setGeneratingReply] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    async function fetchSelectedText() {
      try {
        const text = await getSelectedText();
        if (text && text.trim()) {
          setSelectedText(text.trim());
        } else {
          setError("テキストが選択されていません");
        }
      } catch (error) {
        setError("選択したテキストを取得できませんでした");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSelectedText();
  }, []);

  // テキストが設定されたら並列でAI生成開始
  useEffect(() => {
    if (selectedText && !error) {
      // 並列で全ての返信タイプを生成開始
      replyTypes.forEach(replyType => {
        generateReplyForType(replyType.id);
      });
    }
  }, [selectedText, error]);

  const generateReplyForType = async (type: string) => {
    if (generatedReplies[type] || generatingReply[type]) return;
    
    setGeneratingReply(prev => ({ ...prev, [type]: true }));
    try {
      const reply = await generateReply(selectedText, type);
      setGeneratedReplies(prev => ({ ...prev, [type]: reply }));
      showToast({ 
        title: "返信を生成しました", 
        message: `${replyTypes.find(r => r.id === type)?.title}の返信が完了`
      });
    } catch (error) {
      console.error("返信生成エラー:", error);
      showToast({ 
        style: Toast.Style.Failure, 
        title: "生成エラー", 
        message: error instanceof Error ? error.message : "返信の生成に失敗しました"
      });
    } finally {
      setGeneratingReply(prev => ({ ...prev, [type]: false }));
    }
  };

  const isShowingDetail = !isLoading && !error && selectedText.length > 0;

  return (
    <List isLoading={isLoading} isShowingDetail={isShowingDetail}>
      {error && (
        <List.EmptyView
          title="エラー"
          description={error}
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="エラー内容をコピー" content={error} />
            </ActionPanel>
          }
        />
      )}
      {!isLoading && !error && selectedText && replyTypes.map((replyType, index) => {
        const reply = generatedReplies[replyType.id];
        const isGenerating = generatingReply[replyType.id];
        const replyLines = reply ? reply.split('\n').length : 0;
        
        return (
          <List.Item
            key={replyType.id}
            icon={replyType.icon}
            title={replyType.title}
            subtitle={`⌘${index + 1}${isGenerating ? " (生成中...)" : reply ? " (生成済み)" : ""}`}
            detail={
              <List.Item.Detail
                markdown={reply ? `## AI生成の返信文\n\n${reply}` : isGenerating ? "## AI生成中...\n\n返信を生成しています。しばらくお待ちください。" : "## 生成待機中\n\n返信の生成を開始しています..."}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="種類" text={replyType.title} />
                    <List.Item.Detail.Metadata.Label title="説明" text={replyType.description} />
                    <List.Item.Detail.Metadata.Label 
                      title="予想される長さ" 
                      text={replyType.length}
                      icon={{ source: Icon.Text, tintColor: Color.Blue }}
                    />
                    {reply && (
                      <List.Item.Detail.Metadata.Label 
                        title="実際の行数" 
                        text={`${replyLines}行`}
                        icon={{ source: Icon.List, tintColor: Color.Green }}
                      />
                    )}
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="元の文章" text={selectedText.substring(0, 100) + (selectedText.length > 100 ? "..." : "")} />
                    <List.Item.Detail.Metadata.Label 
                      title="文字数" 
                      text={`${selectedText.length}文字`}
                      icon={{ source: Icon.Document, tintColor: Color.Orange }}
                    />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label 
                      title="AI生成状態" 
                      text={isGenerating ? "生成中..." : reply ? "生成済み" : "開始待ち"}
                      icon={{ source: Icon.Stars, tintColor: isGenerating ? Color.Orange : reply ? Color.Green : Color.SecondaryText }}
                    />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            accessories={[
              {
                text: replyType.length,
                icon: { 
                  source: isGenerating ? Icon.Clock : reply ? Icon.CheckCircle : replyType.icon, 
                  tintColor: isGenerating ? Color.Orange : reply ? Color.Green : Color.Blue 
                },
                tooltip: `${replyType.title}: ${replyType.description}`,
              },
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section title={`${replyType.title}の返信`}>
                  {reply && (
                    <Action.CopyToClipboard
                      icon={Icon.Clipboard}
                      title={`${replyType.title}の返信文をコピー`}
                      content={reply}
                      onCopy={() => showToast({ title: `${replyType.title}の返信文をコピーしました` })}
                    />
                  )}
                  {reply && (
                    <Action
                      icon={Icon.Stars}
                      title={`${replyType.title}の返信を再生成`}
                      onAction={() => {
                        setGeneratedReplies(prev => {
                          const newReplies = { ...prev };
                          delete newReplies[replyType.id];
                          return newReplies;
                        });
                        generateReplyForType(replyType.id);
                      }}
                    />
                  )}
                </ActionPanel.Section>
                <ActionPanel.Section title="その他">
                  <Action.CopyToClipboard
                    icon={Icon.Text}
                    title="元の文章をコピー"
                    content={selectedText}
                    onCopy={() => showToast({ title: "元の文章をコピーしました" })}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
