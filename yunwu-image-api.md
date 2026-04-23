# yunwu-image API 文档

## 文档信息

- 来源入口：[https://yunwu.apifox.cn/doc-5459017](https://yunwu.apifox.cn/doc-5459017)
- 抓取范围：`绘画模型` 目录下全部并列页面，共 48 页（说明页 6，接口页 42）
- 抓取时间：2026-04-22 16:01:10 CST
- 推荐 Base URL：`https://yunwu.ai`
- 通用鉴权：`Authorization: Bearer {{YOUR_API_KEY}}`
- 通用请求头：`Accept: application/json`，按接口需要设置 `Content-Type`

## 关键说明

:::tip
创建图像时，如果需要上传图片文件，你必须从本地上传一个**小于 4MB** 的 `.png` 文件
:::

![image.png](https://api.apifox.cn/api/v1/projects/2100343/resources/388747/image-preview)

## 模型分组概览

| 分组 | 说明页数 | 接口数 |
| --- | --- | --- |
| Midjourney | 0 | 9 |
| Ideogram | 0 | 9 |
| GPT Image 系列 | 0 | 8 |
| Grok Image 系列 | 0 | 2 |
| DALL·E 3 | 0 | 1 |
| FLUX 系列 | 2 | 4 |
| 豆包系列 | 0 | 1 |
| Fal.ai平台 | 1 | 3 |
| 腾讯AIGC生图 | 1 | 2 |
| 千问Qwen 系列 | 0 | 3 |

## 接口总览

| 分组 | 接口 | 方法 | 路径 | 状态 |
| --- | --- | --- | --- | --- |
| Midjourney | 上传图片 | POST | /mj/submit/upload-discord-images | 正常 |
| Midjourney | 提交Imagine任务 | POST | /mj/submit/imagine | 正常 |
| Midjourney | 根据任务ID 查询任务状态 | GET | /mj/task/1743326750223591/fetch | 正常 |
| Midjourney | 根据ID列表查询任务 | POST | /mj/task/list-by-condition | 正常 |
| Midjourney | 获取任务图片的seed | GET | /mj/task/{id}/image-seed | 正常 |
| Midjourney | 执行Action动作 | POST | /mj/submit/action | 正常 |
| Midjourney | 提交Blend任务 | POST | /mj/submit/blend | 正常 |
| Midjourney | 提交Describe任务 | POST | /mj/submit/describe | 正常 |
| Midjourney | 提交Modal | POST | /mj/submit/modal | 正常 |
| Ideogram | Generate 3.0（文生图）Generate  | POST | /ideogram/v1/ideogram-v3/generate | 正常 |
| Ideogram | Generate 3.0（图片编辑）Edit | POST | /ideogram/v1/ideogram-v3/edit | 正常 |
| Ideogram | Generate 3.0（图片重制）Remix  | POST | /ideogram/v1/ideogram-v3/remix | 正常 |
| Ideogram | Generate 3.0（图片重构）Reframe  | POST | /ideogram/v1/ideogram-v3/reframe | 正常 |
| Ideogram | Generate 3.0（替换背景） Replace Background | POST | /ideogram/v1/ideogram-v3/replace-background | 正常 |
| Ideogram | ideogram（文生图） | POST | /ideogram/generate | 正常 |
| Ideogram | Remix（混合图） | POST | /ideogram/remix | 正常 |
| Ideogram | Upscale（放大高清） | POST | /ideogram/upscale | 正常 |
| Ideogram | Describe（描述） | POST | /ideogram/describe | 正常 |
| GPT Image 系列 | 创建  gpt-image-1 | POST | /v1/images/generations | 正常 |
| GPT Image 系列 | 编辑  gpt-image-1 | POST | /v1/images/edits | 正常 |
| GPT Image 系列 | 蒙版  gpt-image-1 | POST | /v1/images/edits | 正常 |
| GPT Image 系列 | 创建  gpt-image-1.5 | POST | /v1/images/generations | 正常 |
| GPT Image 系列 | 编辑  gpt-image-1.5 | POST | /v1/images/edits | 正常 |
| GPT Image 系列 | 蒙版  gpt-image-1.5 | POST | /v1/images/edits | 正常 |
| GPT Image 系列 | 编辑  gpt-image-2 | POST | /v1/images/edits | 正常 |
| GPT Image 系列 | 创建  gpt-image-2 | POST | /v1/images/generations | 正常 |
| Grok Image 系列 | 创建 Image | POST | /v1/images/generations | 正常 |
| Grok Image 系列 | 编辑 image | POST | /v1/images/edits | 正常 |
| DALL·E 3 | 创建 DALL·E 3 | POST | /v1/images/generations | 正常 |
| FLUX 系列 | Flux 创建（OpenAI dall-e-3格式） | POST | /v1/images/generations | 正常 |
| FLUX 系列 | Flux编辑（OpenAI dall-e-3格式） | POST | /v1/images/edits | 正常 |
| FLUX 系列 | 创建任务 black-forest-labs/flux-kontext-dev | POST | /replicate/v1/models/black-forest-labs/flux-kontext-dev/predictions | 正常 |
| FLUX 系列 | 查询任务 | GET | /replicate/v1/predictions/{任务id} | 正常 |
| 豆包系列 | 创建图片 | POST | /v1/images/generations | 正常 |
| Fal.ai平台 | 获取请求结果  | GET | /fal-ai/{model_name}/requests/{request_id} | 正常 |
| Fal.ai平台 | /fal-ai/nano-banana 文生图 | POST | /fal-ai/nano-banana | 正常 |
| Fal.ai平台 | /fal-ai/nano-banana/edit 图片编辑 | POST | /fal-ai/nano-banana/edit | 正常 |
| 腾讯AIGC生图 | 获取请求结果  | GET | /tencent-vod/v1/query/{task_id} | 正常 |
| 腾讯AIGC生图 | 创建任务 | POST | /tencent-vod/v1/aigc-image | 正常 |
| 千问Qwen 系列 | qwen-image-max | POST | /v1/images/generations | 异常(-2) |
| 千问Qwen 系列 | z-image-turbo | POST | /v1/images/generations | 异常(-2) |
| 千问Qwen 系列 | qwen-image-edit-2509 | POST | /v1/images/generations | 正常 |

## 使用说明与对象定义

### README

- 更新时间：`2024-11-11T15:55:00.000Z`
- 原始页面：[https://yunwu.apifox.cn/doc-5459017](https://yunwu.apifox.cn/doc-5459017)

:::tip
创建图像时，如果需要上传图片文件，你必须从本地上传一个**小于 4MB** 的 `.png` 文件
:::

![image.png](https://api.apifox.cn/api/v1/projects/2100343/resources/388747/image-preview)

### 图像对象

- 更新时间：`2024-11-11T15:55:00.000Z`
- 原始页面：[https://yunwu.apifox.cn/doc-5459018](https://yunwu.apifox.cn/doc-5459018)

表示 OpenAI API 生成的图像的 url 或内容。


| 参数 | 类型 | 描述 |
|-|-|-|
| b64_json | string | 如果response_format为b64_json,则生成图像的base64编码JSON |
| url | string | 如果response_format为url(默认),则生成图像的URL |
| revised_prompt | string | 如果提示有任何修订,则用于生成图像的提示 |

```JSON
{
  "url": "...",
  "revised_prompt": "..."
}
```

### Flux 分辨率

- 更新时间：`2025-07-12T07:00:32.000Z`
- 原始页面：[https://yunwu.apifox.cn/doc-7023049](https://yunwu.apifox.cn/doc-7023049)

![image.png](https://api.apifox.com/api/v1/projects/3868318/resources/529775/image-preview)

### 接入教程 

- 更新时间：`2025-07-12T07:00:29.000Z`
- 原始页面：[https://yunwu.apifox.cn/doc-7023048](https://yunwu.apifox.cn/doc-7023048)

### Replicate 官方格式调用
| 如果有需要的模型可以联系客服添加

将官网的 https://api.replicate.com 更换为 {{BASE_URL}}/replicate
输入、输出、请求方式跟官网一致

接入流程
1. 创建任务
    提交任务后，获取到任务 ID
2. 获取任务进度
    通过任务ID查询任务进度，获取结果
    
    
PS：返回的资源连接仅有1个小时有效期    

返回体 关键字段说明

项目	类型	说明
input	object	输入
output	string 或者 []string	内容输出 url
status	string	状态 状态 starting processing succeeded failed


1.生成任务.路径方式
以 black-forest-labs/flux-schnell 为例
```
curl --request POST \
  --url {{BASE_URL}}/replicate/v1/models/black-forest-labs/flux-schnell/predictions \
  --header 'Authorization: Bearer hk-you-key' \
  --header 'Content-Type: application/json' \
  --data '{
    "input": {
      "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)",
      "go_fast": true,
      "megapixels": "1",
      "num_outputs": 1,
      "aspect_ratio": "1:1",
      "output_format": "jpg",
      "output_quality": 80,
      "num_inference_steps": 4
    }
  }'
```

返回体 id 为下一步查询任务 id
```
{
  "id": "qpt5jq1fssrmc0cmd5hvy31mdg",
  "model": "black-forest-labs/flux-schnell",
  "version": "dp-4d0bcc010b3049749a251855f12800be",
  "input": {
    "aspect_ratio": "1:1",
    "go_fast": true,
    "megapixels": "1",
    "num_inference_steps": 4,
    "num_outputs": 1,
    "output_format": "jpg",
    "output_quality": 80,
    "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)"
  },
  "logs": "",
  "output": null,
  "data_removed": false,
  "error": null,
  "status": "starting",
  "created_at": "2025-01-15T09:54:55.566Z",
  "urls": {
    "cancel": "https://api.replicate.com/v1/predictions/qpt5jq1fssrmc0cmd5hvy31mdg/cancel",
    "get": "https://api.replicate.com/v1/predictions/qpt5jq1fssrmc0cmd5hvy31mdg",
    "stream": "https://stream.replicate.com/v1/files/bcwr-gvuc2rokjozhlaxh6dcvk6tvhh2ymt4egnnpxvmtqql57angyfsq"
  }
}
```

2.生成任务.version 方式
以 lucataco/flux-schnell-lora 为例子
参考文档 https://replicate.com/lucataco/flux-schnell-lora?input=http
通过参考文档 得到 version 为 2a6b576af31790b470f0a8442e1e9791213fa13799cbb65a9fc1436e96389574
```
curl --request POST \
  --url {{BASE_URL}}/replicate/v1/predictions \
  --header 'Authorization: Bearer hk-your-key' \
  --header 'Content-Type: application/json' \
  --data '{
    "version": "2a6b576af31790b470f0a8442e1e9791213fa13799cbb65a9fc1436e96389574",
    "input": {
      "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)",
      "hf_lora": "alvdansen/frosting_lane_flux",
      "lora_scale": 0.8,
      "num_outputs": 1,
      "aspect_ratio": "1:1",
      "output_format": "webp",
      "output_quality": 80,
      "prompt_strength": 0.8,
      "num_inference_steps": 4
    }
  }'
```

返回体格式上面格式一致
获取任务
通过上面的生产任何获取到 任务 id
结果在关键字段 output 上
注意 返回结果及其链接文件都有时效性
get {{BASE_URL}}/replicate/v1/predictions/{id}

```
curl --request GET \
  --url {{BASE_URL}}/replicate/v1/predictions/ctdwaehfz1rm80cmd5nsjd8114 \
  --header 'Authorization: Bearer hk-you-key' \
  --header 'Content-Type: application/json'
```
返回体

```json
{
  "id": "ctdwaehfz1rm80cmd5nsjd8114",
  "model": "black-forest-labs/flux-schnell",
  "version": "dp-4d0bcc010b3049749a251855f12800be",
  "input": {
    "aspect_ratio": "1:1",
    "go_fast": true,
    "megapixels": "1",
    "num_inference_steps": 4,
    "num_outputs": 1,
    "output_format": "jpg",
    "output_quality": 80,
    "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)"
  },
  "logs": "Using seed: 62182\nrunning quantized prediction\nUsing seed: 62182\n  0%|          | 0/4 [00:00<?, ?it/s]\n 75%|███████▌  | 3/4 [00:00<00:00, 15.38it/s]\n100%|██████████| 4/4 [00:00<00:00, 13.43it/s]\nTotal safe images: 1 out of 1\n",
  "output": [
    "https://replicate.delivery/xezq/RoEhEdyl8PoIGFFPg46TU4Svj24i1NDVYmzehJfqLuX9nTFUA/out-0.jpg"
  ],
  "data_removed": false,
  "error": null,
  "status": "succeeded",
  "created_at": "2025-01-15T10:03:39.896Z",
  "started_at": "2025-01-15T10:03:40.584470194Z",
  "completed_at": "2025-01-15T10:03:41.142386377Z",
  "urls": {
    "cancel": "https://api.replicate.com/v1/predictions/ctdwaehfz1rm80cmd5nsjd8114/cancel",
    "get": "https://api.replicate.com/v1/predictions/ctdwaehfz1rm80cmd5nsjd8114",
    "stream": "https://stream.replicate.com/v1/files/bcwr-q57vie7wuzg3wxv2hvpajgmzqzmxe67kqddednevutmrpdcft6xq"
  },
  "metrics": {
    "image_count": 1,
    "predict_time": 0.557916184
  }
}
```

### Fal.ai平台 - 状态码

- 更新时间：`2025-09-11T17:20:15.000Z`
- 原始页面：[https://yunwu.apifox.cn/doc-7391956](https://yunwu.apifox.cn/doc-7391956)

// FalAI任务状态常量
const (
	FalAIStatusInQueue    = "IN_QUEUE"  
	FalAIStatusInProgress = "IN_PROGRESS"
	FalAIStatusCompleted  = "COMPLETED"
	FalAIStatusFailed     = "FAILED"
)

### 腾讯AIGC生图 - 状态码

- 更新时间：`2025-12-29T14:34:37.000Z`
- 原始页面：[https://yunwu.apifox.cn/doc-7942948](https://yunwu.apifox.cn/doc-7942948)

// 任务状态常量
const (
	FalAIStatusInQueue    = "IN_QUEUE"  
	FalAIStatusInProgress = "IN_PROGRESS"
	FalAIStatusCompleted  = "COMPLETED"
	FalAIStatusFailed     = "FAILED"
)

## API 详情

### Midjourney

#### 上传图片

- Endpoint：`POST /mj/submit/upload-discord-images`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-277975070](https://yunwu.apifox.cn/api-277975070)
- 说明：官方文档：https://docs.midjourney.com/hc/en-us/articles/33329380893325-Managing-Image-Uploads

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| content-type | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| base64Array | array | 是 |  |  |

**请求示例**

```json
{
  "base64Array": [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAEroAAAbTCAYAAACjv0FTAAAACXBIWXMAA…"
  ]
}
```

**响应示例**

_无_

#### 提交Imagine任务

- Endpoint：`POST /mj/submit/imagine`
- 更新时间：`2025-08-22T09:53:13.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421938](https://yunwu.apifox.cn/api-232421938)
- 说明：官方文档：https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| botType | string | 是 | bot类型，mj(默认)或niji |  |
| prompt | string | 是 | 提示词 |  |
| base64Array | array | 否 | 垫图base64数组<br><br> |  |
| notifyHook | string | 否 | 回调地址, 为空时使用全局notifyHook<br><br> |  |
| state | string | 否 | 自定义参数 |  |

**请求示例**

```json
{
  "base64Array": [],
  "notifyHook": "",
  "prompt": "cat",
  "state": "",
  "botType": "MID_JOURNEY"
}
```

**响应示例**

```json
{ "code": 1, "description": "Submit success", "result": "1730621718151844",//任务id "properties": { "discordChannelId": "1300842676874379336", "discordInstanceId": "1572398367386955776" } }
```

#### 根据任务ID 查询任务状态

- Endpoint：`GET /mj/task/1743326750223591/fetch`
- 更新时间：`2025-03-30T09:42:38.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421939](https://yunwu.apifox.cn/api-232421939)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| model | string | 否 | 用于图像生成的模型。 |  |
| n | integer | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| quality | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |
| response_format | string | 否 | 返回生成的图像的格式。必须是 或url之一b64_json。 |  |
| style | string | 否 | 生成图像的大小。必须是`256x256`、`512x512`或`1024x1024`for之一`dall-e-2`。对于模型来说，必须是`1024x1024`、`1792x1024`、 或之一。`1024x1792``dall-e-3` |  |
| user | string | 否 | 生成图像的风格。必须是 或`vivid`之一`natural`。生动使模型倾向于生成超真实和戏剧性的图像。自然使模型生成更自然、不太真实的图像。此参数仅支持`dall-e-3`. |  |
| size | string | 否 | 生成图像的大小。必须是256x256、512x512或 1024x1024之一。 |  |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "id": "1730621826053455",
  "action": "IMAGINE",
  "customId": "",
  "botType": "",
  "prompt": "pig --v 6.1",
  "promptEn": "pig --v 6.1",
  "...": "..."
}
```

#### 根据ID列表查询任务

- Endpoint：`POST /mj/task/list-by-condition`
- 更新时间：`2025-03-30T09:42:41.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421940](https://yunwu.apifox.cn/api-232421940)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| ids | array | 是 |  |  |

**请求示例**

```json
{
  "ids": [
    "1743326750223591"
  ]
}
```

**响应示例**

```json
{
  "id": "1730621826053455",
  "action": "IMAGINE",
  "customId": "",
  "botType": "",
  "prompt": "pig --v 6.1",
  "promptEn": "pig --v 6.1",
  "...": "..."
}
```

#### 获取任务图片的seed

- Endpoint：`GET /mj/task/{id}/image-seed`
- 更新时间：`2024-11-26T08:13:27.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421941](https://yunwu.apifox.cn/api-232421941)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| id | string | 是 |  |  |

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| model | string | 否 | 用于图像生成的模型。 |  |
| n | integer | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| quality | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |
| response_format | string | 否 | 返回生成的图像的格式。必须是 或url之一b64_json。 |  |
| style | string | 否 | 生成图像的大小。必须是`256x256`、`512x512`或`1024x1024`for之一`dall-e-2`。对于模型来说，必须是`1024x1024`、`1792x1024`、 或之一。`1024x1792``dall-e-3` |  |
| user | string | 否 | 生成图像的风格。必须是 或`vivid`之一`natural`。生动使模型倾向于生成超真实和戏剧性的图像。自然使模型生成更自然、不太真实的图像。此参数仅支持`dall-e-3`. |  |
| size | string | 否 | 生成图像的大小。必须是256x256、512x512或 1024x1024之一。 |  |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "id": "1730621826053455",
  "action": "IMAGINE",
  "customId": "",
  "botType": "",
  "prompt": "pig --v 6.1",
  "promptEn": "pig --v 6.1",
  "...": "..."
}
```

#### 执行Action动作

- Endpoint：`POST /mj/submit/action`
- 更新时间：`2025-08-01T02:34:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421942](https://yunwu.apifox.cn/api-232421942)
- 说明：官方文档：https://docs.midjourney.com/hc/en-us/articles/32804058614669-Upscalers

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| chooseSameChannel | boolean | 是 | 是否选择同一频道下的账号，默认只使用任务关联的账号<br><br> |  |
| customId | string | 否 | 动作标识 |  |
| taskId | string | 否 | 任务ID |  |
| notifyHook | string | 否 | 回调地址, 为空时使用全局notifyHook<br><br> |  |
| state | string | 否 | 自定义参数<br> |  |

**请求示例**

```json
{
  "chooseSameChannel": true,
  "customId": "MJ::JOB::upsample::2::3dbbd469-36af-4a0f-8f02-df6c579e7011",
  "taskId": "14001934816969359",
  "notifyHook": "",
  "state": ""
}
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

#### 提交Blend任务

- Endpoint：`POST /mj/submit/blend`
- 更新时间：`2025-08-01T02:34:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421943](https://yunwu.apifox.cn/api-232421943)
- 说明：官方文档：https://docs.midjourney.com/hc/en-us/articles/32635189884557-Blend-Images-on-Discord

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| botType | string | 是 | bot类型，mj(默认)或niji<br><br> |  |
| base64Array | string | 否 | 图片base64数组<br><br> |  |
| dimensions | string | 否 | 比例: PORTRAIT(2:3); SQUARE(1:1); LANDSCAPE(3:2)<br><br> |  |
| quality | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |
| notifyHook | string | 否 | 回调地址, 为空时使用全局notifyHook<br><br> |  |
| state | string | 否 | 自定义参数<br> |  |

**请求示例**

```json
{
  "botType": "MID_JOURNEY",
  "base64Array": [
    "data:image/png;base64,xxx1",
    "data:image/png;base64,xxx2"
  ],
  "dimensions": "SQUARE",
  "notifyHook": "",
  "state": ""
}
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

#### 提交Describe任务

- Endpoint：`POST /mj/submit/describe`
- 更新时间：`2025-08-26T14:07:28.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421944](https://yunwu.apifox.cn/api-232421944)
- 说明：官方文档：https://docs.midjourney.com/hc/en-us/articles/32497889043981-Describe

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| botType | string | 是 | bot类型，mj(默认)或niji<br><br> |  |
| base64 | string | 否 | 用于图像生成的模型。 |  |
| notifyHook | integer | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| state | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |

**请求示例**

```json
{
  "botType": "MID_JOURNEY",
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAElgGNhQlgAA…",
  "notifyHook": "",
  "state": ""
}
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

#### 提交Modal

- Endpoint：`POST /mj/submit/modal`
- 更新时间：`2025-11-12T09:49:06.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421946](https://yunwu.apifox.cn/api-232421946)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| maskBase64 | string | 是 | 局部重绘的蒙版base64<br><br> |  |
| prompt | string | 否 | 提示词<br> |  |
| taskId | integer | 否 | 任务ID<br> |  |

**请求示例**

```json
{
  "maskBase64": "",
  "prompt": "",
  "taskId": "14001934816969359"
}
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

### Ideogram

#### Generate 3.0（文生图）Generate 

- Endpoint：`POST /ideogram/v1/ideogram-v3/generate`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-295835676](https://yunwu.apifox.cn/api-295835676)
- 说明：使用 Ideogram 3.0 模型，根据给定的提示和可选参数同步生成图像 具体参数请看官方文档：https://developer.ideogram.ai/api-reference/api-reference/generate-v3 返回的图像 URL 在 24 小时内有效，超过该时间将无法访问图像。 已反代图片

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | application/json |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 生成图像所需的提示文本 |  |
| seed | integer | 否 | 随机种子。设置此值可获得可重复的生成结果 |  |
| resolution | string | 否 | 支持的分辨率选项 |  |
| aspect_ratio | string | 否 | 用于图像生成的纵横比，决定图像的分辨率。不能与resolution参数同时使用。默认为1x1 |  |
| rendering_speed | string | 否 | 渲染速度选项 | DEFAULT |
| magic_prompt | string | 否 | 决定是否在生成请求时使用Magic Prompt |  |
| negative_prompt | string | 否 | 描述要在图像中排除的内容。提示中的描述优先于负面提示中的描述 |  |
| num_images | integer | 否 | 要生成的图像数量 | 1 |
| color_palette | object | 否 | 生成的颜色调色板，必须通过预设之一（name）或通过带有可选权重的颜色的十六进制表示（members）明确指定 |  |
| style_codes | array | 否 | 表示图像风格的8字符十六进制代码列表。不能与style_reference_images或style_type一起使用 |  |
| style_type | string | 否 | 要生成的风格类型 | GENERAL |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "data": [
    "{...}"
  ],
  "created": "2025-08-27T18:23:28.806107195+08:00"
}
```

#### Generate 3.0（图片编辑）Edit

- Endpoint：`POST /ideogram/v1/ideogram-v3/edit`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-295871433](https://yunwu.apifox.cn/api-295871433)
- 说明：使用 Ideogram 3.0 模型，根据给定的提示和可选参数同步生成图像 具体参数请看官方文档：https://developer.ideogram.ai/api-reference/api-reference/edit-v3 返回的图像 URL 在 24 小时内有效，超过该时间将无法访问图像。 已反代图片

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 生成图像所需的提示文本 |  |
| seed | integer | 否 | 随机种子。设置此值可获得可重复的生成结果 |  |
| resolution | string | 否 | 支持的分辨率选项 |  |
| aspect_ratio | string | 否 | 用于图像生成的纵横比，决定图像的分辨率。不能与resolution参数同时使用。默认为1x1 |  |
| rendering_speed | string | 否 | 渲染速度选项 | DEFAULT |
| magic_prompt | string | 否 | 决定是否在生成请求时使用Magic Prompt |  |
| negative_prompt | string | 否 | 描述要在图像中排除的内容。提示中的描述优先于负面提示中的描述 |  |
| num_images | integer | 否 | 要生成的图像数量 | 1 |
| color_palette | object | 否 | 生成的颜色调色板，必须通过预设之一（name）或通过带有可选权重的颜色的十六进制表示（members）明确指定 |  |
| style_codes | array | 否 | 表示图像风格的8字符十六进制代码列表。不能与style_reference_images或style_type一起使用 |  |
| style_type | string | 否 | 要生成的风格类型 | GENERAL |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "CjMT7WdSwWcAAAAAALvB3g",
  "data": {
    "task_id": "CjMT7WdSwWcAAAAAALvB3g",
    "task_status": "submitted",
    "created_at": 1733851336696,
    "updated_at": 1733851336696
  }
}
```

#### Generate 3.0（图片重制）Remix 

- Endpoint：`POST /ideogram/v1/ideogram-v3/remix`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-295904276](https://yunwu.apifox.cn/api-295904276)
- 说明：使用 Ideogram 3.0 模型，根据给定的提示和可选参数同步生成图像 具体参数请看官方文档：https://developer.ideogram.ai/api-reference/api-reference/remix-v3 返回的图像 URL 在 24 小时内有效，超过该时间将无法访问图像。 已反代图片

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 生成图像所需的提示文本 |  |
| seed | integer | 否 | 随机种子。设置此值可获得可重复的生成结果 |  |
| resolution | string | 否 | 支持的分辨率选项 |  |
| aspect_ratio | string | 否 | 用于图像生成的纵横比，决定图像的分辨率。不能与resolution参数同时使用。默认为1x1 |  |
| rendering_speed | string | 否 | 渲染速度选项 | DEFAULT |
| magic_prompt | string | 否 | 决定是否在生成请求时使用Magic Prompt |  |
| negative_prompt | string | 否 | 描述要在图像中排除的内容。提示中的描述优先于负面提示中的描述 |  |
| num_images | integer | 否 | 要生成的图像数量 | 1 |
| color_palette | object | 否 | 生成的颜色调色板，必须通过预设之一（name）或通过带有可选权重的颜色的十六进制表示（members）明确指定 |  |
| style_codes | array | 否 | 表示图像风格的8字符十六进制代码列表。不能与style_reference_images或style_type一起使用 |  |
| style_type | string | 否 | 要生成的风格类型 | GENERAL |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "data": [
    "{...}"
  ],
  "created": "2025-08-27T22:13:44.972624193+08:00"
}
```

#### Generate 3.0（图片重构）Reframe 

- Endpoint：`POST /ideogram/v1/ideogram-v3/reframe`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-295903393](https://yunwu.apifox.cn/api-295903393)
- 说明：使用 Ideogram 3.0 模型，根据给定的提示和可选参数同步生成图像 具体参数请看官方文档：https://developer.ideogram.ai/api-reference/api-reference/reframe-v3 返回的图像 URL 在 24 小时内有效，超过该时间将无法访问图像。 已反代图片

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 生成图像所需的提示文本 |  |
| seed | integer | 否 | 随机种子。设置此值可获得可重复的生成结果 |  |
| resolution | string | 否 | 支持的分辨率选项 |  |
| aspect_ratio | string | 否 | 用于图像生成的纵横比，决定图像的分辨率。不能与resolution参数同时使用。默认为1x1 |  |
| rendering_speed | string | 否 | 渲染速度选项 | DEFAULT |
| magic_prompt | string | 否 | 决定是否在生成请求时使用Magic Prompt |  |
| negative_prompt | string | 否 | 描述要在图像中排除的内容。提示中的描述优先于负面提示中的描述 |  |
| num_images | integer | 否 | 要生成的图像数量 | 1 |
| color_palette | object | 否 | 生成的颜色调色板，必须通过预设之一（name）或通过带有可选权重的颜色的十六进制表示（members）明确指定 |  |
| style_codes | array | 否 | 表示图像风格的8字符十六进制代码列表。不能与style_reference_images或style_type一起使用 |  |
| style_type | string | 否 | 要生成的风格类型 | GENERAL |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "CjMT7WdSwWcAAAAAALvB3g",
  "data": {
    "task_id": "CjMT7WdSwWcAAAAAALvB3g",
    "task_status": "submitted",
    "created_at": 1733851336696,
    "updated_at": 1733851336696
  }
}
```

#### Generate 3.0（替换背景） Replace Background

- Endpoint：`POST /ideogram/v1/ideogram-v3/replace-background`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-295906880](https://yunwu.apifox.cn/api-295906880)
- 说明：使用 Ideogram 3.0 模型，根据给定的提示和可选参数同步生成图像 具体参数请看官方文档：https://developer.ideogram.ai/api-reference/api-reference/replace-background-v3 返回的图像 URL 在 24 小时内有效，超过该时间将无法访问图像。 已反代图片

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 生成图像所需的提示文本 |  |
| seed | integer | 否 | 随机种子。设置此值可获得可重复的生成结果 |  |
| resolution | string | 否 | 支持的分辨率选项 |  |
| aspect_ratio | string | 否 | 用于图像生成的纵横比，决定图像的分辨率。不能与resolution参数同时使用。默认为1x1 |  |
| rendering_speed | string | 否 | 渲染速度选项 | DEFAULT |
| magic_prompt | string | 否 | 决定是否在生成请求时使用Magic Prompt |  |
| negative_prompt | string | 否 | 描述要在图像中排除的内容。提示中的描述优先于负面提示中的描述 |  |
| num_images | integer | 否 | 要生成的图像数量 | 1 |
| color_palette | object | 否 | 生成的颜色调色板，必须通过预设之一（name）或通过带有可选权重的颜色的十六进制表示（members）明确指定 |  |
| style_codes | array | 否 | 表示图像风格的8字符十六进制代码列表。不能与style_reference_images或style_type一起使用 |  |
| style_type | string | 否 | 要生成的风格类型 | GENERAL |

**请求示例**

```json
{
  "prompt": "<string>"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "CjMT7WdSwWcAAAAAALvB3g",
  "data": {
    "task_id": "CjMT7WdSwWcAAAAAALvB3g",
    "task_status": "submitted",
    "created_at": 1733851336696,
    "updated_at": 1733851336696
  }
}
```

#### ideogram（文生图）

- Endpoint：`POST /ideogram/generate`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-244680463](https://yunwu.apifox.cn/api-244680463)
- 说明：Generates images synchronously based on a given prompt and optional parameters. 具体参数请看官方文档：https://developer.ideogram.ai/api-reference/api-reference/describe 根据给定的提示和可选参数同步生成图像。 返回的图像 URL 在 24 小时内有效，超过该时间将无法访问图像。 已反代图片

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | application/json |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image_request | object | 是 | 图像请求对象 (必填) |  |

**请求示例**

```json
{
  "image_request": {
    "aspect_ratio": "ASPECT_10_16",
    "magic_prompt_option": "AUTO",
    "model": "V_1",
    "prompt": "A serene tropical beach scene. Dominating the foreground are tall palm trees wi…"
  }
}
```

**响应示例**

```json
{
  "created": "2024-12-15T17:32:00.965408+00:00",
  "data": [
    "{...}"
  ]
}
```

#### Remix（混合图）

- Endpoint：`POST /ideogram/remix`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-244685410](https://yunwu.apifox.cn/api-244685410)
- 说明：官方文档：https://developer.ideogram.ai/api-reference/api-reference/remix

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | multipart/form-data |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | 使用的模型，可选，默认为 kling-image |  |
| prompt | string | 是 | 正向提示词，必需，描述你想要生成的图像内容，不能超过500个字符 |  |
| negative_prompt | string | 是 | 负向提示词，可选，描述你不想在图像中出现的元素，不能超过200个字符 |  |
| image | string | 是 | 参考图片，可选，支持 Base64 编码或图片 URL，支持 .jpg/.jpeg/.png 格式，大小不能超过 10MB |  |
| image_fidelity | number | 是 | 参考图片的影响强度，可选，取值范围：0-1，值越大，生成的图像越接近参考图片 |  |
| n | integer | 是 | 生成图片的数量，可选，取值范围：1-9 |  |
| aspect_ratio | string | 是 | 生成图片的纵横比，可选，可选值：16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3 |  |
| callback_url | string | 是 | 回调通知地址，可选，当任务状态发生变化时，系统会向这个地址发送通知 |  |

**请求示例**

```json
{
  "model": "<string>",
  "prompt": "<string>",
  "negative_prompt": "<string>",
  "image": "<string>",
  "image_fidelity": 0,
  "n": 0
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "CjMT7WdSwWcAAAAAALvB3g",
  "data": {
    "task_id": "CjMT7WdSwWcAAAAAALvB3g",
    "task_status": "submitted",
    "created_at": 1733851336696,
    "updated_at": 1733851336696
  }
}
```

#### Upscale（放大高清）

- Endpoint：`POST /ideogram/upscale`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-244685729](https://yunwu.apifox.cn/api-244685729)
- 说明：官方文档：https://developer.ideogram.ai/api-reference/api-reference/upscale

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |
| Content-Type | string | 否 |  | multipart/form-data |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | 使用的模型，可选，默认为 kling-image |  |
| prompt | string | 是 | 正向提示词，必需，描述你想要生成的图像内容，不能超过500个字符 |  |
| negative_prompt | string | 是 | 负向提示词，可选，描述你不想在图像中出现的元素，不能超过200个字符 |  |
| image | string | 是 | 参考图片，可选，支持 Base64 编码或图片 URL，支持 .jpg/.jpeg/.png 格式，大小不能超过 10MB |  |
| image_fidelity | number | 是 | 参考图片的影响强度，可选，取值范围：0-1，值越大，生成的图像越接近参考图片 |  |
| n | integer | 是 | 生成图片的数量，可选，取值范围：1-9 |  |
| aspect_ratio | string | 是 | 生成图片的纵横比，可选，可选值：16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3 |  |
| callback_url | string | 是 | 回调通知地址，可选，当任务状态发生变化时，系统会向这个地址发送通知 |  |

**请求示例**

```json
{
  "model": "<string>",
  "prompt": "<string>",
  "negative_prompt": "<string>",
  "image": "<string>",
  "image_fidelity": 0,
  "n": 0
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "CjMT7WdSwWcAAAAAALvB3g",
  "data": {
    "task_id": "CjMT7WdSwWcAAAAAALvB3g",
    "task_status": "submitted",
    "created_at": 1733851336696,
    "updated_at": 1733851336696
  }
}
```

#### Describe（描述）

- Endpoint：`POST /ideogram/describe`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-244685783](https://yunwu.apifox.cn/api-244685783)
- 说明：官方文档：https://developer.ideogram.ai/api-reference/api-reference/describe

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | application/json |
| Accept | string | 是 |  | application/json |
| Authorization | string | 是 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | 使用的模型，可选，默认为 kling-image |  |
| prompt | string | 是 | 正向提示词，必需，描述你想要生成的图像内容，不能超过500个字符 |  |
| negative_prompt | string | 是 | 负向提示词，可选，描述你不想在图像中出现的元素，不能超过200个字符 |  |
| image | string | 是 | 参考图片，可选，支持 Base64 编码或图片 URL，支持 .jpg/.jpeg/.png 格式，大小不能超过 10MB |  |
| image_fidelity | number | 是 | 参考图片的影响强度，可选，取值范围：0-1，值越大，生成的图像越接近参考图片 |  |
| n | integer | 是 | 生成图片的数量，可选，取值范围：1-9 |  |
| aspect_ratio | string | 是 | 生成图片的纵横比，可选，可选值：16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3 |  |
| callback_url | string | 是 | 回调通知地址，可选，当任务状态发生变化时，系统会向这个地址发送通知 |  |

**请求示例**

```json
{
  "model": "<string>",
  "prompt": "<string>",
  "negative_prompt": "<string>",
  "image": "<string>",
  "image_fidelity": 0,
  "n": 0
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "CjMT7WdSwWcAAAAAALvB3g",
  "data": {
    "task_id": "CjMT7WdSwWcAAAAAALvB3g",
    "task_status": "submitted",
    "created_at": 1733851336696,
    "updated_at": 1733851336696
  }
}
```

### GPT Image 系列

#### 创建  gpt-image-1

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2025-12-17T08:32:30.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-290549047](https://yunwu.apifox.cn/api-290549047)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/create

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | application/json |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| n | integer | 是 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| size | string | 是 | 生成图像的尺寸。对于 GPT 图像模型，必须是 1024x1024 、 1536x1024 （横版）、 1024x1536 （竖版）或 auto （默认值）之一，对于 dall-e-2 必须是 256x256 、 512x512 或 1024x1024 之一，对于 dall-e-3 必须是 1024x1024 、 1792x1024 或 1024x1792 之一。<br><br> |  |

**请求示例**

```json
{
  "size": "1024x1536",
  "prompt": "一只可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 编辑  gpt-image-1

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2025-12-17T08:32:22.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-290558485](https://yunwu.apifox.cn/api-290558485)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/createEdit

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image | string | 是 | 要编辑的图片。必须是受支持的图片文件或图片数组。对于 gpt-image-1，每张图片应为小于 25MB 的 png、webp 或 jpg 文件。对于 dall-e-2，您只能提供一张图片，并且该图片应为小于 4MB 的方形 png 文件。 |  |
| prompt | string | 是 | 所需图像的文本描述。dall-e-2 的最大长度为 1000 个字符，gpt-image-1 的最大长度为 32000 个字符。 |  |
| mask | string | 是 | 一张附加图片，其完全透明区域（例如，alpha 值为零）指示应编辑 image 位置。如果提供了多张图片，则遮罩将应用于第一张图片。必须是有效的 PNG 文件，小于 4MB，且尺寸与 image 相同。 |  |
| model | string | 是 | 用于生成图像的模型。仅支持 dall-e-2 和 gpt-image-1。除非使用特定于 gpt-image-1 参数，否则默认为 dall-e-2。 |  |
| n | integer | 是 | 要生成的图像数量。必须介于 1 到 10 之间。 |  |
| quality | string | 是 | 生成图像的质量。只有 gpt-image-1 支持 high、medium 和 low 质量。dall-e-2 仅支持 standard 质量。默认为 auto。 |  |
| response_format | string | 是 | 返回生成图像的格式。必须是 url 或 b64_json 之一。URL 在图像生成后 60 分钟内有效。此参数仅适用于 dall-e-2，因为 gpt-image-1 始终返回 base64 编码的图像。 |  |
| size | string | 是 | 生成图像的尺寸。对于 gpt-image-1，必须为 1024x1024、1536x1024（横向）、1024x1536（纵向）或 auto（默认值）之一；对于 dall-e-2，必须为 256x256、512x512 或 1024x1024 之一。 |  |

**请求示例**

```json
{
  "size": "1024x1024",
  "prompt": "一直可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 蒙版  gpt-image-1

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2025-12-17T08:32:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-313708616](https://yunwu.apifox.cn/api-313708616)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/createEdit

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image | string | 是 | 要编辑的图片。必须是受支持的图片文件或图片数组。对于 gpt-image-1，每张图片应为小于 25MB 的 png、webp 或 jpg 文件。对于 dall-e-2，您只能提供一张图片，并且该图片应为小于 4MB 的方形 png 文件。 |  |
| prompt | string | 是 | 所需图像的文本描述。dall-e-2 的最大长度为 1000 个字符，gpt-image-1 的最大长度为 32000 个字符。 |  |
| mask | string | 是 | 一张附加图片，其完全透明区域（例如，alpha 值为零）指示应编辑 image 位置。如果提供了多张图片，则遮罩将应用于第一张图片。必须是有效的 PNG 文件，小于 4MB，且尺寸与 image 相同。 |  |
| model | string | 是 | 用于生成图像的模型。仅支持 dall-e-2 和 gpt-image-1。除非使用特定于 gpt-image-1 参数，否则默认为 dall-e-2。 |  |
| n | integer | 是 | 要生成的图像数量。必须介于 1 到 10 之间。 |  |
| quality | string | 是 | 生成图像的质量。只有 gpt-image-1 支持 high、medium 和 low 质量。dall-e-2 仅支持 standard 质量。默认为 auto。 |  |
| response_format | string | 是 | 返回生成图像的格式。必须是 url 或 b64_json 之一。URL 在图像生成后 60 分钟内有效。此参数仅适用于 dall-e-2，因为 gpt-image-1 始终返回 base64 编码的图像。 |  |
| size | string | 是 | 生成图像的尺寸。对于 gpt-image-1，必须为 1024x1024、1536x1024（横向）、1024x1536（纵向）或 auto（默认值）之一；对于 dall-e-2，必须为 256x256、512x512 或 1024x1024 之一。 |  |

**请求示例**

```json
{
  "size": "1024x1024",
  "prompt": "一直可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 创建  gpt-image-1.5

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2025-12-25T07:22:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-392793165](https://yunwu.apifox.cn/api-392793165)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/create

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | application/json |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| n | integer | 是 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| size | string | 是 | 生成图像的尺寸。对于 GPT 图像模型，必须是 1024x1024 、 1536x1024 （横版）、 1024x1536 （竖版）或 auto （默认值）之一，对于 dall-e-2 必须是 256x256 、 512x512 或 1024x1024 之一，对于 dall-e-3 必须是 1024x1024 、 1792x1024 或 1024x1792 之一。<br><br> |  |

**请求示例**

```json
{
  "size": "1024x1536",
  "prompt": "a man walks",
  "model": "gpt-image-1.5",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 编辑  gpt-image-1.5

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2025-12-25T07:22:54.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-393805052](https://yunwu.apifox.cn/api-393805052)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/createEdit

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image | string | 是 | 要编辑的图片。必须是受支持的图片文件或图片数组。对于 gpt-image-1，每张图片应为小于 25MB 的 png、webp 或 jpg 文件。对于 dall-e-2，您只能提供一张图片，并且该图片应为小于 4MB 的方形 png 文件。 |  |
| prompt | string | 是 | 所需图像的文本描述。dall-e-2 的最大长度为 1000 个字符，gpt-image-1 的最大长度为 32000 个字符。 |  |
| mask | string | 是 | 一张附加图片，其完全透明区域（例如，alpha 值为零）指示应编辑 image 位置。如果提供了多张图片，则遮罩将应用于第一张图片。必须是有效的 PNG 文件，小于 4MB，且尺寸与 image 相同。 |  |
| model | string | 是 | 用于生成图像的模型。仅支持 dall-e-2 和 gpt-image-1。除非使用特定于 gpt-image-1 参数，否则默认为 dall-e-2。 |  |
| n | integer | 是 | 要生成的图像数量。必须介于 1 到 10 之间。 |  |
| quality | string | 是 | 生成图像的质量。只有 gpt-image-1 支持 high、medium 和 low 质量。dall-e-2 仅支持 standard 质量。默认为 auto。 |  |
| response_format | string | 是 | 返回生成图像的格式。必须是 url 或 b64_json 之一。URL 在图像生成后 60 分钟内有效。此参数仅适用于 dall-e-2，因为 gpt-image-1 始终返回 base64 编码的图像。 |  |
| size | string | 是 | 生成图像的尺寸。对于 gpt-image-1，必须为 1024x1024、1536x1024（横向）、1024x1536（纵向）或 auto（默认值）之一；对于 dall-e-2，必须为 256x256、512x512 或 1024x1024 之一。 |  |

**请求示例**

```json
{
  "size": "1024x1024",
  "prompt": "一直可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 蒙版  gpt-image-1.5

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2025-12-18T20:37:33.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-393805053](https://yunwu.apifox.cn/api-393805053)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/createEdit

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image | string | 是 | 要编辑的图片。必须是受支持的图片文件或图片数组。对于 gpt-image-1，每张图片应为小于 25MB 的 png、webp 或 jpg 文件。对于 dall-e-2，您只能提供一张图片，并且该图片应为小于 4MB 的方形 png 文件。 |  |
| prompt | string | 是 | 所需图像的文本描述。dall-e-2 的最大长度为 1000 个字符，gpt-image-1 的最大长度为 32000 个字符。 |  |
| mask | string | 是 | 一张附加图片，其完全透明区域（例如，alpha 值为零）指示应编辑 image 位置。如果提供了多张图片，则遮罩将应用于第一张图片。必须是有效的 PNG 文件，小于 4MB，且尺寸与 image 相同。 |  |
| model | string | 是 | 用于生成图像的模型。仅支持 dall-e-2 和 gpt-image-1。除非使用特定于 gpt-image-1 参数，否则默认为 dall-e-2。 |  |
| n | integer | 是 | 要生成的图像数量。必须介于 1 到 10 之间。 |  |
| quality | string | 是 | 生成图像的质量。只有 gpt-image-1 支持 high、medium 和 low 质量。dall-e-2 仅支持 standard 质量。默认为 auto。 |  |
| response_format | string | 是 | 返回生成图像的格式。必须是 url 或 b64_json 之一。URL 在图像生成后 60 分钟内有效。此参数仅适用于 dall-e-2，因为 gpt-image-1 始终返回 base64 编码的图像。 |  |
| size | string | 是 | 生成图像的尺寸。对于 gpt-image-1，必须为 1024x1024、1536x1024（横向）、1024x1536（纵向）或 auto（默认值）之一；对于 dall-e-2，必须为 256x256、512x512 或 1024x1024 之一。 |  |

**请求示例**

```json
{
  "size": "1024x1024",
  "prompt": "一直可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 编辑  gpt-image-2

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2026-04-20T06:38:48.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-446294920](https://yunwu.apifox.cn/api-446294920)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/createEdit

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image | string | 是 | 要编辑的图片。必须是受支持的图片文件或图片数组。对于 gpt-image-1，每张图片应为小于 25MB 的 png、webp 或 jpg 文件。对于 dall-e-2，您只能提供一张图片，并且该图片应为小于 4MB 的方形 png 文件。 |  |
| prompt | string | 是 | 所需图像的文本描述。dall-e-2 的最大长度为 1000 个字符，gpt-image-1 的最大长度为 32000 个字符。 |  |
| mask | string | 是 | 一张附加图片，其完全透明区域（例如，alpha 值为零）指示应编辑 image 位置。如果提供了多张图片，则遮罩将应用于第一张图片。必须是有效的 PNG 文件，小于 4MB，且尺寸与 image 相同。 |  |
| model | string | 是 | 用于生成图像的模型。仅支持 dall-e-2 和 gpt-image-1。除非使用特定于 gpt-image-1 参数，否则默认为 dall-e-2。 |  |
| n | integer | 是 | 要生成的图像数量。必须介于 1 到 10 之间。 |  |
| quality | string | 是 | 生成图像的质量。只有 gpt-image-1 支持 high、medium 和 low 质量。dall-e-2 仅支持 standard 质量。默认为 auto。 |  |
| response_format | string | 是 | 返回生成图像的格式。必须是 url 或 b64_json 之一。URL 在图像生成后 60 分钟内有效。此参数仅适用于 dall-e-2，因为 gpt-image-1 始终返回 base64 编码的图像。 |  |
| size | string | 是 | 生成图像的尺寸。对于 gpt-image-1，必须为 1024x1024、1536x1024（横向）、1024x1536（纵向）或 auto（默认值）之一；对于 dall-e-2，必须为 256x256、512x512 或 1024x1024 之一。 |  |

**请求示例**

```json
{
  "size": "1024x1024",
  "prompt": "一直可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 创建  gpt-image-2

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2026-04-20T06:57:29.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-446321534](https://yunwu.apifox.cn/api-446321534)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/create

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Content-Type | string | 是 |  | application/json |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| n | integer | 是 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| size | string | 是 | 生成图像的尺寸。对于 GPT 图像模型，必须是 1024x1024 、 1536x1024 （横版）、 1024x1536 （竖版）或 auto （默认值）之一，对于 dall-e-2 必须是 256x256 、 512x512 或 1024x1024 之一，对于 dall-e-3 必须是 1024x1024 、 1792x1024 或 1024x1792 之一。<br><br> |  |

**请求示例**

```json
{
  "size": "1024x1536",
  "prompt": "一只可爱的小猪",
  "model": "gpt-image-2-all",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

### Grok Image 系列

#### 创建 Image

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2026-03-10T07:28:50.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-425475208](https://yunwu.apifox.cn/api-425475208)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | 用于生成图像的模型。 |  |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| size | string | 否 | 生成图像的尺寸：<br>960x960、720x1280、1280x720、1168x784、784x1168 |  |

**请求示例**

```json
{
  "model": "grok-3-image",
  "prompt": "a cat",
  "size": "960x960"
}
```

**响应示例**

```json
{
  "created": 1773127037,
  "data": [
    "{...}"
  ],
  "usage": {
    "generated_images": 1,
    "output_tokens": 16384,
    "total_tokens": 16384
  }
}
```

#### 编辑 image

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2026-04-14T03:38:51.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-425481728](https://yunwu.apifox.cn/api-425481728)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

_无_

**请求示例**

_无_

**响应示例**

```json
{
  "created": 1773127037,
  "data": [
    "{...}"
  ],
  "usage": {
    "generated_images": 1,
    "output_tokens": 16384,
    "total_tokens": 16384
  }
}
```

### DALL·E 3

#### 创建 DALL·E 3

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-326547908](https://yunwu.apifox.cn/api-326547908)
- 说明：[图片](https://platform.openai.com/docs/api-reference/images) 给定提示和/或输入图像，模型将生成新图像。 相关指南：[图像生成](https://platform.openai.com/docs/guides/images) 根据提示创建图像。

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| model | string | 否 | 用于图像生成的模型。 |  |
| n | integer | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| quality | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |
| response_format | string | 否 | 返回生成的图像的格式。必须是 或url之一b64_json。 |  |
| style | string | 否 | 生成图像的风格。此参数仅支持 dall-e-3 。必须是 vivid 或 natural 之一。生动会使模型倾向于生成超现实和戏剧性的图像。自然则使模型生成更自然、看起来不那么超现实的图像。<br><br> |  |
| user | string | 否 | 一个唯一的标识符，代表您的最终用户，这可以帮助 OpenAI 监控和检测滥用行为。 |  |
| size | string | 否 | 生成图像的大小。必须是 1024x1024 、 1536x1024 （横向）、 1024x1536 （纵向）或 auto （默认值）中的一个，适用于 gpt-image-1 ；是 256x256 、 512x512 或 1024x1024 中的一个，适用于 dall-e-2 ；以及是 1024x1024 、 1792x1024 或 1024x1792 中的一个，适用于 dall-e-3 。<br><br> |  |

**请求示例**

```json
{
  "model": "dall-e-3",
  "prompt": "A cute baby sea otter",
  "n": 1,
  "size": "1024x1024"
}
```

**响应示例**

```json
{
  "created": 1749819664,
  "data": [
    "{...}"
  ]
}
```

### FLUX 系列

**分组补充说明**

#### Flux 分辨率

![image.png](https://api.apifox.com/api/v1/projects/3868318/resources/529775/image-preview)

#### 接入教程 

### Replicate 官方格式调用
| 如果有需要的模型可以联系客服添加

将官网的 https://api.replicate.com 更换为 {{BASE_URL}}/replicate
输入、输出、请求方式跟官网一致

接入流程
1. 创建任务
    提交任务后，获取到任务 ID
2. 获取任务进度
    通过任务ID查询任务进度，获取结果
    
    
PS：返回的资源连接仅有1个小时有效期    

返回体 关键字段说明

项目	类型	说明
input	object	输入
output	string 或者 []string	内容输出 url
status	string	状态 状态 starting processing succeeded failed


1.生成任务.路径方式
以 black-forest-labs/flux-schnell 为例
```
curl --request POST \
  --url {{BASE_URL}}/replicate/v1/models/black-forest-labs/flux-schnell/predictions \
  --header 'Authorization: Bearer hk-you-key' \
  --header 'Content-Type: application/json' \
  --data '{
    "input": {
      "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)",
      "go_fast": true,
      "megapixels": "1",
      "num_outputs": 1,
      "aspect_ratio": "1:1",
      "output_format": "jpg",
      "output_quality": 80,
      "num_inference_steps": 4
    }
  }'
```

返回体 id 为下一步查询任务 id
```
{
  "id": "qpt5jq1fssrmc0cmd5hvy31mdg",
  "model": "black-forest-labs/flux-schnell",
  "version": "dp-4d0bcc010b3049749a251855f12800be",
  "input": {
    "aspect_ratio": "1:1",
    "go_fast": true,
    "megapixels": "1",
    "num_inference_steps": 4,
    "num_outputs": 1,
    "output_format": "jpg",
    "output_quality": 80,
    "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)"
  },
  "logs": "",
  "output": null,
  "data_removed": false,
  "error": null,
  "status": "starting",
  "created_at": "2025-01-15T09:54:55.566Z",
  "urls": {
    "cancel": "https://api.replicate.com/v1/predictions/qpt5jq1fssrmc0cmd5hvy31mdg/cancel",
    "get": "https://api.replicate.com/v1/predictions/qpt5jq1fssrmc0cmd5hvy31mdg",
    "stream": "https://stream.replicate.com/v1/files/bcwr-gvuc2rokjozhlaxh6dcvk6tvhh2ymt4egnnpxvmtqql57angyfsq"
  }
}
```

2.生成任务.version 方式
以 lucataco/flux-schnell-lora 为例子
参考文档 https://replicate.com/lucataco/flux-schnell-lora?input=http
通过参考文档 得到 version 为 2a6b576af31790b470f0a8442e1e9791213fa13799cbb65a9fc1436e96389574
```
curl --request POST \
  --url {{BASE_URL}}/replicate/v1/predictions \
  --header 'Authorization: Bearer hk-your-key' \
  --header 'Content-Type: application/json' \
  --data '{
    "version": "2a6b576af31790b470f0a8442e1e9791213fa13799cbb65a9fc1436e96389574",
    "input": {
      "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)",
      "hf_lora": "alvdansen/frosting_lane_flux",
      "lora_scale": 0.8,
      "num_outputs": 1,
      "aspect_ratio": "1:1",
      "output_format": "webp",
      "output_quality": 80,
      "prompt_strength": 0.8,
      "num_inference_steps": 4
    }
  }'
```

返回体格式上面格式一致
获取任务
通过上面的生产任何获取到 任务 id
结果在关键字段 output 上
注意 返回结果及其链接文件都有时效性
get {{BASE_URL}}/replicate/v1/predictions/{id}

```
curl --request GET \
  --url {{BASE_URL}}/replicate/v1/predictions/ctdwaehfz1rm80cmd5nsjd8114 \
  --header 'Authorization: Bearer hk-you-key' \
  --header 'Content-Type: application/json'
```
返回体

```json
{
  "id": "ctdwaehfz1rm80cmd5nsjd8114",
  "model": "black-forest-labs/flux-schnell",
  "version": "dp-4d0bcc010b3049749a251855f12800be",
  "input": {
    "aspect_ratio": "1:1",
    "go_fast": true,
    "megapixels": "1",
    "num_inference_steps": 4,
    "num_outputs": 1,
    "output_format": "jpg",
    "output_quality": 80,
    "prompt": "Japanese cartoon anime style, (1 person) (Gender: Male, Age: 30, Hair: Short black hair, Outfit: Dark blue hunting attire, includes a fitted jacket and trousers.) (A dimly lit room filled with tension,  is questioning Female, 27 years old, long black hair, pink tulle dress., who stands nervously in her pink dress, the sound of rain pattering against the window.)"
  },
  "logs": "Using seed: 62182\nrunning quantized prediction\nUsing seed: 62182\n  0%|          | 0/4 [00:00<?, ?it/s]\n 75%|███████▌  | 3/4 [00:00<00:00, 15.38it/s]\n100%|██████████| 4/4 [00:00<00:00, 13.43it/s]\nTotal safe images: 1 out of 1\n",
  "output": [
    "https://replicate.delivery/xezq/RoEhEdyl8PoIGFFPg46TU4Svj24i1NDVYmzehJfqLuX9nTFUA/out-0.jpg"
  ],
  "data_removed": false,
  "error": null,
  "status": "succeeded",
  "created_at": "2025-01-15T10:03:39.896Z",
  "started_at": "2025-01-15T10:03:40.584470194Z",
  "completed_at": "2025-01-15T10:03:41.142386377Z",
  "urls": {
    "cancel": "https://api.replicate.com/v1/predictions/ctdwaehfz1rm80cmd5nsjd8114/cancel",
    "get": "https://api.replicate.com/v1/predictions/ctdwaehfz1rm80cmd5nsjd8114",
    "stream": "https://stream.replicate.com/v1/files/bcwr-q57vie7wuzg3wxv2hvpajgmzqzmxe67kqddednevutmrpdcft6xq"
  },
  "metrics": {
    "image_count": 1,
    "predict_time": 0.557916184
  }
}
```

#### Flux 创建（OpenAI dall-e-3格式）

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-232421932](https://yunwu.apifox.cn/api-232421932)
- 说明：[图片](https://platform.openai.com/docs/api-reference/images) 给定提示和/或输入图像，模型将生成新图像。 相关指南：[图像生成](https://platform.openai.com/docs/guides/images) 根据提示创建图像。

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| model | string | 否 | 用于图像生成的模型。 |  |
| n | integer | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| quality | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |
| response_format | string | 否 | 返回生成的图像的格式。必须是 或url之一b64_json。 |  |
| style | string | 否 | 风格 |  |
| user | string | 否 | 生成图像的风格。必须是 或`vivid`之一`natural`。生动使模型倾向于生成超真实和戏剧性的图像。自然使模型生成更自然、不太真实的图像。此参数仅支持`dall-e-3`. |  |
| size | string | 否 | 生成图像的大小。必须是256x256、512x512或 1024x1024之一。 |  |
| aspect_ratio | string | 是 | 图片比例:  枚举值Possible enum values: 21:9, 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16, 9:21 |  |

**请求示例**

```json
{ "model": "flux-kontext-pro", "prompt": "a beautiful landscape with a river and mountains", // "size": "1024x1524", "n": 1, "aspect_ratio": "21:9" }
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

#### Flux编辑（OpenAI dall-e-3格式）

- Endpoint：`POST /v1/images/edits`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-306816728](https://yunwu.apifox.cn/api-306816728)
- 说明：给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。 为提供的提示和参数创建完成 官方文档：https://platform.openai.com/docs/api-reference/images/createEdit

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Accept | string | 是 |  | application/json |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| image | string | 是 | 要编辑的图片。必须是受支持的图片文件或图片数组。对于 gpt-image-1，每张图片应为小于 25MB 的 png、webp 或 jpg 文件。对于 dall-e-2，您只能提供一张图片，并且该图片应为小于 4MB 的方形 png 文件。 |  |
| prompt | string | 是 | 所需图像的文本描述。dall-e-2 的最大长度为 1000 个字符，gpt-image-1 的最大长度为 32000 个字符。 |  |
| mask | string | 是 | 一张附加图片，其完全透明区域（例如，alpha 值为零）指示应编辑 image 位置。如果提供了多张图片，则遮罩将应用于第一张图片。必须是有效的 PNG 文件，小于 4MB，且尺寸与 image 相同。 |  |
| model | string | 是 | 用于生成图像的模型。仅支持 dall-e-2 和 gpt-image-1。除非使用特定于 gpt-image-1 参数，否则默认为 dall-e-2。 |  |
| n | integer | 是 | 要生成的图像数量。必须介于 1 到 10 之间。 |  |
| quality | string | 是 | 生成图像的质量。只有 gpt-image-1 支持 high、medium 和 low 质量。dall-e-2 仅支持 standard 质量。默认为 auto。 |  |
| response_format | string | 是 | 返回生成图像的格式。必须是 url 或 b64_json 之一。URL 在图像生成后 60 分钟内有效。此参数仅适用于 dall-e-2，因为 gpt-image-1 始终返回 base64 编码的图像。 |  |
| size | string | 是 | 生成图像的尺寸。对于 gpt-image-1，必须为 1024x1024、1536x1024（横向）、1024x1536（纵向）或 auto（默认值）之一；对于 dall-e-2，必须为 256x256、512x512 或 1024x1024 之一。 |  |

**请求示例**

```json
{
  "size": "1024x1024",
  "prompt": "一直可爱的小猪",
  "model": "gpt-image-1",
  "n": 1
}
```

**响应示例**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "choices": [
    "{...}"
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 创建任务 black-forest-labs/flux-kontext-dev

- Endpoint：`POST /replicate/v1/models/black-forest-labs/flux-kontext-dev/predictions`
- 更新时间：`2025-08-22T07:44:30.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-321167741](https://yunwu.apifox.cn/api-321167741)
- 说明：官方文档: https://replicate.com/black-forest-labs/flux-kontext-dev

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| input | object | 否 |  |  |

**请求示例**

```json
{
  "input": {
    "prompt": "Change the car color to red, turn the headlights on",
    "go_fast": true,
    "guidance": 2.5,
    "input_image": "https://replicate.delivery/pbxt/N5YURZv4ifaW2bMwU7hmrwzgtxf99DTQXpBeobLt1O7dEc3…",
    "aspect_ratio": "match_input_image",
    "output_format": "jpg",
    "...": "..."
  }
}
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

#### 查询任务

- Endpoint：`GET /replicate/v1/predictions/{任务id}`
- 更新时间：`2025-07-24T06:30:28.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-321172927](https://yunwu.apifox.cn/api-321172927)
- 说明：官方文档: https://replicate.com/black-forest-labs/flux-kontext-max

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| 任务id | string | 是 |  | w44zs9cet5rmc0cqzp49gpkhf8 |

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |  |
| model | string | 否 | 用于图像生成的模型。 |  |
| n | integer | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |  |
| quality | string | 否 | 将生成的图像的质量。`hd`创建具有更精细细节和更高一致性的图像。此参数仅支持`dall-e-3`. |  |
| response_format | string | 否 | 返回生成的图像的格式。必须是 或url之一b64_json。 |  |
| style | string | 否 | 风格 |  |
| user | string | 否 | 生成图像的风格。必须是 或`vivid`之一`natural`。生动使模型倾向于生成超真实和戏剧性的图像。自然使模型生成更自然、不太真实的图像。此参数仅支持`dall-e-3`. |  |
| size | string | 否 | 生成图像的大小。必须是256x256、512x512或 1024x1024之一。 |  |
| aspect_ratio | string | 是 | 图片比例:  枚举值Possible enum values: 21:9, 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16, 9:21 |  |

**请求示例**

```json
{
  "prompt": "<string>",
  "aspect_ratio": "<string>"
}
```

**响应示例**

```json
{
  "created": 1589478378,
  "data": [
    "{...}",
    "{...}"
  ]
}
```

### 豆包系列

#### 创建图片

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2026-03-06T09:47:34.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-328094105](https://yunwu.apifox.cn/api-328094105)
- 说明：给定提示和/或输入图像，模型将生成新图像。 相关指南：[图像生成](https://www.volcengine.com/docs/82379/1541523) 根据提示创建图像。

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | - 支持：文生图<br>	- doubao-seedream-3-0-t2i-250415<br>- 支持：图片编辑<br>	- doubao-seededit-3-0-i2i-250628<br>- 支持：文生图、图生图<br>	- doubao-seedream-5-0-260128<br>	- doubao-seedream-4-5-251128<br>	- doubao-seedream-4-0-250828 |  |
| prompt | string | 是 | 用于生成图像的提示词。 |  |
| image |  | 否 | 输入的图片信息，支持 URL 或 Base64 编码。<br><br>- 图片URL：请确保图片URL可被访问。<br>- Base64编码：请遵循此格式data:image/<图片格式>;base64,<Base64编码>。注意 <图片格式> 需小写，如 data:image/png;base64,<base64_image>。 |  |
| size |  | 否 |  |  |
| seed | integer | 否 | 仅 doubao-seedream-3.0-t2i/seededit-3.0-i2i 支持该参<br>随机数种子，用于控制模型生成内容的随机性。取值范围为 [-1, 2147483647]。<br>注意：<br>- 相同的请求下，模型收到不同的seed值，如：不指定seed值或令seed取值为-1（会使用随机数替代）、或手动变更seed值，将生成不同的结果。<br>- 相同的请求下，模型收到相同的seed值，会生成类似的结果，但不保证完全一致。 |  |
| sequential_image_generation | string | 否 | 仅 doubao-seedream-5.0-lite/4.5/4.0 支持该参<br>控制是否关闭组图功能；基于您输入的内容，生成的一组内容关联的图片。<br>- auto：自动判断模式，模型会根据用户提供的提示词自主判断是否返回组图以及组图包含的图片数量。<br>- disabled：关闭组图功能，模型只会生成一张图。<br><br>默认值 disabled |  |
| sequential_image_generation_options | object | 否 | 仅 doubao-seedream-5.0-lite/4.5/4.0 支持该参<br>组图功能的配置。仅当 sequential_image_generation 为 auto 时生效。 |  |
| guidance_scale | number | 否 | 模型输出结果与prompt的一致程度，生成图像的自由度，又称为文本权重；值越大，模型自由度越小，与用户输入的提示词相关性越强，取值范围：[1, 10] 。<br>- doubao-seedream-3.0-t2i 默认值 2.5<br>- doubao-seededit-3.0-i2i 默认值 5.5<br>- doubao-seedream-5.0-lite/4.5/4.0 不支持 |  |
| output_format | string | 否 | 仅 doubao-seedream-5.0 支持该参<br>指定生成图像的文件格式。可选值：<br>- png<br>- jpeg<br><br>默认值 jpeg |  |
| response_format | string | 否 | 指定生成图像的返回格式。支持以下两种返回方式：<br>- url：返回图片下载链接；链接在图片生成后24小时内有效，请及时下载图片。<br>- b64_json：以 Base64 编码字符串的 JSON 格式返回图像数据。<br><br>默认值 url |  |
| watermark | boolean | 否 | 是否在生成的图片中添加水印。<br>- false：不添加水印。<br>- true：在图片右下角添加“AI生成”字样的水印标识。<br><br>默认值 true |  |

**请求示例**

```json
{
  "model": "doubao-seedream-5-0-260128",
  "prompt": "充满活力的特写编辑肖像，模特眼神犀利，头戴雕塑感帽子，色彩拼接丰富，眼部焦点锐利，景深较浅，具有Vogue杂志封面的美学风格，采用中画幅拍摄，工作室灯光效果强…",
  "size": "2K",
  "output_format": "png",
  "response_format": "url",
  "watermark": false
}
```

**响应示例**

```json
{
  "created": 1749819664,
  "data": [
    "{...}"
  ]
}
```

### Fal.ai平台

**分组补充说明**

#### Fal.ai平台 - 状态码

// FalAI任务状态常量
const (
	FalAIStatusInQueue    = "IN_QUEUE"  
	FalAIStatusInProgress = "IN_PROGRESS"
	FalAIStatusCompleted  = "COMPLETED"
	FalAIStatusFailed     = "FAILED"
)

#### 获取请求结果 

- Endpoint：`GET /fal-ai/{model_name}/requests/{request_id}`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-343816375](https://yunwu.apifox.cn/api-343816375)

**Header 参数**

_无_

**Query 参数**

_无_

**Path 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model_name | string | 是 | 模型名称 | auto |
| request_id | string | 是 | 任务id | acf05732-7cb3-445b-9f39-fdaeccb1d730 |

**Cookie 参数**

_无_

**Body 顶层字段**

_无_

**请求示例**

_无_

**响应示例**

```json
{
  "seed": 2841475369,
  "images": [
    "{...}"
  ],
  "prompt": "Put the little duckling on top of the woman's t-shirt.",
  "request": {
    "prompt": "Put the little duckling on top of the woman's t-shirt.",
    "image_urls": [
      "..."
    ],
    "num_images": 1,
    "output_format": "jpeg",
    "guidance_scale": 3.5,
    "safety_tolerance": "2"
  },
  "timings": {},
  "has_nsfw_concepts": [
    false
  ]
}
```

#### /fal-ai/nano-banana 文生图

- Endpoint：`POST /fal-ai/nano-banana`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-341948426](https://yunwu.apifox.cn/api-341948426)
- 说明：官方文档: https://fal.ai/models/fal-ai/nano-banana

**Header 参数**

_无_

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 生成图片的提示词。 |  |
| num_images | integer | 否 | 生成图片数量。范围值1-4。默认值：1 |  |

**请求示例**

```json
{
  "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. T…",
  "num_images": 1
}
```

**响应示例**

```json
{
  "status": "IN_QUEUE",
  "request_id": "e7e9202c-efb8-40f2-81c3-13b3f7aaa4ca",
  "response_url": "https://queue.fal.run/fal-ai/nano-banana/requests/e7e9202c-efb8-40f2-81c3-13b3f…",
  "status_url": "https://queue.fal.run/fal-ai/nano-banana/requests/e7e9202c-efb8-40f2-81c3-13b3f…",
  "cancel_url": "https://queue.fal.run/fal-ai/nano-banana/requests/e7e9202c-efb8-40f2-81c3-13b3f…",
  "logs": null,
  "...": "..."
}
```

#### /fal-ai/nano-banana/edit 图片编辑

- Endpoint：`POST /fal-ai/nano-banana/edit`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-341952136](https://yunwu.apifox.cn/api-341952136)
- 说明：官方文档: https://fal.ai/models/fal-ai/nano-banana/edit

**Header 参数**

_无_

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| prompt | string | 是 | 图像编辑的提示词。 |  |
| image_urls | array | 是 | 需要编辑的图片url。 |  |
| num_images | integer | 否 | 生成图片数量。范围值1-4。默认值：1 |  |

**请求示例**

```json
{
  "prompt": "make a photo of the man driving the car down the california coastline",
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-in…",
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-in…"
  ],
  "num_images": 1
}
```

**响应示例**

```json
{
  "status": "IN_QUEUE",
  "request_id": "f8837f29-26cb-4213-90f5-22b2911a0ea7",
  "response_url": "https://queue.fal.run/fal-ai/nano-banana/requests/f8837f29-26cb-4213-90f5-22b29…",
  "status_url": "https://queue.fal.run/fal-ai/nano-banana/requests/f8837f29-26cb-4213-90f5-22b29…",
  "cancel_url": "https://queue.fal.run/fal-ai/nano-banana/requests/f8837f29-26cb-4213-90f5-22b29…",
  "logs": null,
  "...": "..."
}
```

### 腾讯AIGC生图

**分组补充说明**

#### 腾讯AIGC生图 - 状态码

// 任务状态常量
const (
	FalAIStatusInQueue    = "IN_QUEUE"  
	FalAIStatusInProgress = "IN_PROGRESS"
	FalAIStatusCompleted  = "COMPLETED"
	FalAIStatusFailed     = "FAILED"
)

#### 获取请求结果 

- Endpoint：`GET /tencent-vod/v1/query/{task_id}`
- 更新时间：`2025-12-29T14:03:46.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-398427540](https://yunwu.apifox.cn/api-398427540)

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| task_id | string | 是 |  |  |

**Cookie 参数**

_无_

**Body 顶层字段**

_无_

**请求示例**

_无_

**响应示例**

```json
{
  "Response": {
    "Status": "FINISH",
    "TaskType": "AigcImageTask",
    "RequestId": "12082802-fe37-410e-ae20-0cf14e91e018",
    "CreateTime": "2025-12-29T12:03:30Z",
    "FinishTime": "2025-12-29T12:03:43Z",
    "AigcImageTask": "{...}",
    "...": "..."
  }
}
```

#### 创建任务

- Endpoint：`POST /tencent-vod/v1/aigc-image`
- 更新时间：`2026-03-03T02:16:02.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-398427541](https://yunwu.apifox.cn/api-398427541)
- 说明：官方文档:https://cloud.tencent.com/document/product/266/126240

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |
| Content-Type | string | 否 |  | application/json |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model_name | string | 是 | 模型名称。取值：<br>GEM：Gemini；<br>Qwen：千问。<br>Hunyuan：混元。<br><br>示例值：GEM |  |
| model_version | string | 是 | 模型版本。取值：<br>当 ModelName 是 GEM，可选值为 2.5、3.0；<br>当 ModelName 是 Qwen，可选值为 0925；<br>当 ModelName 是 Hunyuan，可选值为 3.0；<br><br>示例值：2.5 |  |
| prompt | string | 是 | 提示词 |  |
| file_infos | array | 否 |  |  |
| negative_prompt | string | 否 | 要阻止模型生成图片的提示词。 |  |
| enhance_prompt | string | 否 | 是否自动优化提示词。开启时将自动优化传入的 Prompt，以提升生成质量。取值有：<br>Enabled：开启；<br>Disabled：关闭； |  |
| output_config | object | 否 | 生图任务的输出媒体文件配置。 |  |
| session_id | string | 否 | 用于去重的识别码，如果三天内曾有过相同的识别码的请求，则本次的请求会返回错误。最长 50 个字符，不带或者带空字符串表示不做去重。<br>示例值：mysession |  |
| session_context | string | 否 | 来源上下文，用于透传用户请求信息，音画质重生完成回调将返回该字段值，最长 1000 个字符。<br>示例值：mySessionContext |  |
| tasks_priority | string | 否 | 任务的优先级，数值越大优先级越高，取值范围是 -10 到 10，不填代表 0。<br>示例值：10 |  |
| ext_info | string | 否 | 保留字段，特殊用途时使用。<br>示例值：myextinfo |  |

**请求示例**

```json
{
  "model_name": "GEM",
  "model_version": "3.0",
  "file_infos": [
    "{...}"
  ],
  "prompt": "convert this image to anime style",
  "negative_prompt": "blur, distorted",
  "enhance_prompt": "Enabled",
  "...": "..."
}
```

**响应示例**

```json
{
  "Response": {
    "TaskId": "251007502-AigcImage***2782aff1e896673f1ft",
    "RequestId": "f50d7667-72d8-46bb-a7e3-0613588971b6"
  }
}
```

### 千问Qwen 系列

#### qwen-image-max

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2026-01-08T08:40:19.000Z`
- 状态：`-2`
- 原始页面：[https://yunwu.apifox.cn/api-402380063](https://yunwu.apifox.cn/api-402380063)

**Header 参数**

_无_

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | 模型名称 |  |
| prompt | string | 是 | 图像描述 |  |
| size | string | 是 | 图像尺寸 |  |
| n | integer | 是 | 生成数量 只支持1张 |  |
| watermark | boolean | 是 | 是否水印 |  |
| prompt_extend | boolean | 是 | AI优化提示词 默认开启 |  |

**请求示例**

```json
{
  "model": "qwen-image-max",
  "prompt": "一只可爱的橘猫坐在窗台上，阳光洒在它身上，背景是城市风景",
  "size": "1328x1328",
  "n": 1,
  "watermark": false,
  "prompt_extend": true
}
```

**响应示例**

```json
{
  "created": 1767842675,
  "data": [
    "{...}"
  ]
}
```

#### z-image-turbo

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2026-01-08T08:40:58.000Z`
- 状态：`-2`
- 原始页面：[https://yunwu.apifox.cn/api-402387320](https://yunwu.apifox.cn/api-402387320)

**Header 参数**

_无_

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 | 模型名称 |  |
| prompt | string | 是 | 图像描述 |  |
| size | string | 是 | 图像尺寸 |  |
| n | integer | 是 | 生成数量 只支持1张 |  |
| watermark | boolean | 是 | 是否水印 |  |
| prompt_extend | boolean | 是 | AI优化提示词 |  |

**请求示例**

```json
{
  "model": "z-image-turbo",
  "prompt": "一副典雅庄重的对联悬挂于厅堂之中，房间是个安静古典的中式布置",
  "size": "1280x720",
  "n": 1,
  "watermark": false,
  "prompt_extend": true
}
```

**响应示例**

```json
{
  "created": 1767842675,
  "data": [
    "{...}"
  ]
}
```

#### qwen-image-edit-2509

- Endpoint：`POST /v1/images/generations`
- 更新时间：`2025-11-14T15:11:18.000Z`
- 状态：`1`
- 原始页面：[https://yunwu.apifox.cn/api-354490509](https://yunwu.apifox.cn/api-354490509)
- 说明：给定提示和/或输入图像，模型将生成新图像。

**Header 参数**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| Authorization | string | 否 |  | Bearer {{YOUR_API_KEY}} |

**Query 参数**

_无_

**Path 参数**

_无_

**Cookie 参数**

_无_

**Body 顶层字段**

| 字段 | 类型 | 必填 | 说明 | 示例/默认值 |
| --- | --- | --- | --- | --- |
| model | string | 是 |  |  |
| prompt | string | 是 | 提示词 |  |
| image | string | 是 | 图片url |  |

**请求示例**

```json
{
  "model": "qwen-image-edit-2509",
  "prompt": "把小鸭子放在女人的T恤上面",
  "image": "https://v3.fal.media/files/penguin/XoW0qavfF-ahg-jX4BMyL_image.webp"
}
```

**响应示例**

```json
{
  "data": [
    "{...}"
  ],
  "created": 1758636610
}
```
