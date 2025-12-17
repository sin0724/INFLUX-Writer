import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAnthropicClient, MODEL_SNAPSHOT, markKeyAsError, getClientApiKey } from '@/lib/anthropicClient';
import { buildPrompt } from '@/lib/promptEngine';
import { Category } from '@/lib/types';
import sharp from 'sharp';

// 이미지 자동 정리 함수
async function cleanupOldImages() {
  try {
    // 10일 전 날짜 계산
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoISO = tenDaysAgo.toISOString();

    // 10일 이상 된 이미지 레코드 조회
    const { data: oldImages, error: queryError } = await supabaseAdmin
      .from('job_images')
      .select('*')
      .lt('created_at', tenDaysAgoISO);

    if (queryError || !oldImages || oldImages.length === 0) {
      return;
    }

    // Storage에서 이미지 삭제
    for (const image of oldImages) {
      try {
        await supabaseAdmin.storage
          .from('job-images')
          .remove([image.storage_path]);
      } catch (error) {
        console.error(`이미지 삭제 오류 (${image.storage_path}):`, error);
      }
    }

    // DB에서 이미지 레코드 삭제
    await supabaseAdmin
      .from('job_images')
      .delete()
      .lt('created_at', tenDaysAgoISO);
  } catch (error) {
    console.error('이미지 정리 오류:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      client_id,
      style_preset_id,
      guide_text,
      human_extra_prompt,
      content_type,
      length_hint,
      image_files,
      created_by,
      batch_id,
    } = body;

    // 1. Job 생성 (pending 상태)
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        client_id,
        style_preset_id: style_preset_id || null,
        guide_text,
        human_extra_prompt: human_extra_prompt || null,
        content_type,
        length_hint,
        status: 'pending',
        created_by: created_by || null,
        batch_id: batch_id || null,
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: '작업 생성 실패', details: jobError }, { status: 500 });
    }

    // 2. 이미지 업로드 및 저장
    const imagePaths: string[] = [];
    if (image_files && image_files.length > 0) {
      for (const file of image_files) {
        try {
          // Base64 문자열 처리 (data:image/jpeg;base64,... 형식 또는 순수 base64)
          let base64Data = typeof file === 'string' ? file : '';
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          
          const fileBuffer = Buffer.from(base64Data, 'base64');
          const fileName = `${job.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('job-images')
            .upload(fileName, fileBuffer, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (!uploadError && uploadData) {
            const { data: imageRecord, error: imageError } = await supabaseAdmin
              .from('job_images')
              .insert({
                job_id: job.id,
                storage_path: uploadData.path,
              })
              .select()
              .single();

            if (!imageError && imageRecord) {
              imagePaths.push(uploadData.path);
            }
          } else {
            console.error('이미지 업로드 오류:', uploadError);
          }
        } catch (error) {
          console.error('이미지 처리 오류:', error);
        }
      }
    }

    // 3. 비동기로 Vision 처리 및 원고 생성 시작
    processJobAsync(job.id, client_id, style_preset_id, guide_text, human_extra_prompt, content_type, length_hint, imagePaths).catch((error) => {
      console.error('작업 처리 중 오류:', error);
    });

    // 4. 이미지 정리 작업 (비동기, 에러 무시)
    cleanupOldImages().catch((error) => {
      console.error('이미지 정리 오류:', error);
    });

    return NextResponse.json({ job_id: job.id, status: 'pending' });
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function processJobAsync(
  jobId: string,
  clientId: string,
  stylePresetId: string | null,
  guideText: string,
  humanExtraPrompt: string | null,
  contentType: 'review' | 'info',
  lengthHint: 1000 | 1500,
  imagePaths: string[]
) {
  try {
    // 상태를 processing으로 변경
    await supabaseAdmin
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // 1. 클라이언트 정보 조회
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('클라이언트 정보를 찾을 수 없습니다.');
    }

    // 2. 스타일 프리셋 조회
    let stylePreset = null;
    if (stylePresetId) {
      const { data: preset } = await supabaseAdmin
        .from('style_presets')
        .select('*')
        .eq('id', stylePresetId)
        .single();
      stylePreset = preset;
    }

    // 3. Vision 처리 (이미지가 있는 경우)
    let imageDescriptions: string[] = [];
    if (imagePaths.length > 0) {
      const client = getAnthropicClient();
      
      // 이미지를 base64로 변환 (리사이즈 및 압축 포함)
      const imageBase64Array: Array<{ type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } }> = [];
      
      for (const path of imagePaths) {
        try {
          // Supabase Storage에서 이미지 다운로드
          const { data: imageData, error: downloadError } = await supabaseAdmin.storage
            .from('job-images')
            .download(path);
          
          if (downloadError || !imageData) {
            console.error(`이미지 다운로드 실패 (${path}):`, downloadError);
            continue;
          }
          
          // ArrayBuffer 가져오기
          const arrayBuffer = await imageData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // 이미지 리사이즈 및 압축 (최대 너비 1920px, JPEG 품질 85%)
          let processedBuffer: Buffer;
          try {
            const image = sharp(buffer);
            const metadata = await image.metadata();
            
            // 이미지가 너무 크면 리사이즈 (최대 너비 1920px)
            if (metadata.width && metadata.width > 1920) {
              processedBuffer = await image
                .resize(1920, null, { 
                  withoutEnlargement: true,
                  fit: 'inside'
                })
                .jpeg({ quality: 85, mozjpeg: true })
                .toBuffer();
            } else {
              // 크기가 적절하면 JPEG로 변환만 (품질 85%)
              processedBuffer = await image
                .jpeg({ quality: 85, mozjpeg: true })
                .toBuffer();
            }
          } catch (sharpError) {
            console.error(`이미지 리사이즈 오류 (${path}):`, sharpError);
            // 리사이즈 실패 시 원본 사용
            processedBuffer = buffer;
          }
          
          // base64로 변환
          const base64 = processedBuffer.toString('base64');
          
          // MIME 타입은 항상 image/jpeg로 통일 (압축 후)
          const mediaType: 'image/jpeg' = 'image/jpeg';
          
          // 이미지 크기 체크 (5MB 제한 - base64는 약 33% 더 크므로 3.7MB로 제한)
          const base64SizeMB = (base64.length * 3) / 4 / 1024 / 1024;
          if (base64SizeMB > 3.7) {
            console.warn(`이미지가 너무 큽니다 (${base64SizeMB.toFixed(2)}MB): ${path}, 더 작게 리사이즈 시도`);
            // 더 작게 리사이즈 (최대 너비 1280px)
            try {
              const resizedBuffer = await sharp(buffer)
                .resize(1280, null, { 
                  withoutEnlargement: true,
                  fit: 'inside'
                })
                .jpeg({ quality: 75, mozjpeg: true })
                .toBuffer();
              const resizedBase64 = resizedBuffer.toString('base64');
              const resizedSizeMB = (resizedBase64.length * 3) / 4 / 1024 / 1024;
              
              if (resizedSizeMB > 3.7) {
                console.warn(`리사이즈 후에도 너무 큽니다 (${resizedSizeMB.toFixed(2)}MB): ${path}, 스킵`);
                continue;
              }
              
              imageBase64Array.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: resizedBase64,
                },
              });
            } catch (resizeError) {
              console.error(`이미지 재리사이즈 오류 (${path}):`, resizeError);
              continue;
            }
          } else {
            imageBase64Array.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            });
          }
        } catch (error) {
          console.error(`이미지 처리 오류 (${path}):`, error);
        }
      }

      // Vision 분석 (이미지를 여러 번에 나눠서 보내기 - 한 번에 최대 3개)
      if (imageBase64Array.length > 0) {
        const maxImagesPerRequest = 3;
        const imageBatches: Array<typeof imageBase64Array> = [];
        
        // 이미지를 배치로 나누기
        for (let i = 0; i < imageBase64Array.length; i += maxImagesPerRequest) {
          imageBatches.push(imageBase64Array.slice(i, i + maxImagesPerRequest));
        }
        
        // 각 배치별로 Vision 분석 수행
        for (const batch of imageBatches) {
          try {
            const visionResponse = await client.messages.create({
              model: MODEL_SNAPSHOT,
              max_tokens: 1000,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: '이 사진들을 분석하여 원고 작성에 활용할 수 있는 키워드와 인상, 분위기를 간단히 정리해주세요. 각 사진에 대해 1-2문장으로 요약해주세요.\n\n🚫🚫🚫 절대 금지 사항 (매우 중요):\n- 사진에 보이는 모든 숫자 (가격, 시간, 번호, 점수, 날짜, 수량 등) 절대 언급 금지\n- 사진에 보이는 모든 영어 단어, 문장, 텍스트 절대 언급 금지\n- 시험지, 문제지, 교재, 학습 자료에 적힌 내용 절대 언급 금지\n- 숫자나 영어는 OCR 오인식이 매우 높으므로 절대 사용하지 마세요\n\n✅ 허용 사항:\n- 오직 시각적 인상, 분위기, 색감, 공간감, 느낌, 분위기만 묘사\n- 예: "밝고 깔끔한 공간", "정돈된 분위기", "편안한 느낌" 등\n- 구체적인 텍스트나 숫자는 절대 포함하지 마세요',
                    },
                    ...batch,
                  ],
                },
              ],
            });

            const visionText = visionResponse.content[0].type === 'text' ? visionResponse.content[0].text : '';
            const batchDescriptions = visionText.split('\n').filter((line) => line.trim().length > 0);
            imageDescriptions.push(...batchDescriptions);
          } catch (visionError: any) {
            console.error('Vision 처리 오류:', visionError);
            
            // 크레딧 부족 에러 확인
            const visionErrorMessage = visionError.message || '';
            const visionErrorBody = visionError.error || {};
            const isVisionCreditError = 
              visionError.status === 400 && 
              (visionErrorMessage.includes('credit balance is too low') || 
               visionErrorMessage.includes('credit') ||
               visionErrorBody.type === 'invalid_request_error' && visionErrorMessage.includes('credit'));
            
            // 크레딧 부족이면 해당 키를 에러 상태로 표시하고 다른 키로 재시도
            if (isVisionCreditError) {
              const visionKey = getClientApiKey(client);
              if (visionKey) {
                markKeyAsError(visionKey);
                console.warn(`Vision API 키 에러 상태로 표시 (크레딧 부족): ${visionKey.substring(0, 20)}...`);
              }
              
              // 다른 키로 재시도
              const newClient = getAnthropicClient();
              try {
                const retryVisionResponse = await newClient.messages.create({
                  model: MODEL_SNAPSHOT,
                  max_tokens: 1000,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: '이 사진들을 분석하여 원고 작성에 활용할 수 있는 키워드와 인상, 분위기를 간단히 정리해주세요. 각 사진에 대해 1-2문장으로 요약해주세요.\n\n🚫🚫🚫 절대 금지 사항 (매우 중요):\n- 사진에 보이는 모든 숫자 (가격, 시간, 번호, 점수, 날짜, 수량 등) 절대 언급 금지\n- 사진에 보이는 모든 영어 단어, 문장, 텍스트 절대 언급 금지\n- 시험지, 문제지, 교재, 학습 자료에 적힌 내용 절대 언급 금지\n- 숫자나 영어는 OCR 오인식이 매우 높으므로 절대 사용하지 마세요\n\n✅ 허용 사항:\n- 오직 시각적 인상, 분위기, 색감, 공간감, 느낌, 분위기만 묘사\n- 예: "밝고 깔끔한 공간", "정돈된 분위기", "편안한 느낌" 등\n- 구체적인 텍스트나 숫자는 절대 포함하지 마세요',
                        },
                        ...batch,
                      ],
                    },
                  ],
                });
                
                const retryVisionText = retryVisionResponse.content[0].type === 'text' ? retryVisionResponse.content[0].text : '';
                const retryBatchDescriptions = retryVisionText.split('\n').filter((line) => line.trim().length > 0);
                imageDescriptions.push(...retryBatchDescriptions);
                continue; // 성공했으면 다음 배치로
              } catch (retryError: any) {
                console.error('Vision 재시도 오류:', retryError);
                // 재시도도 실패하면 스킵
              }
            }
            
            // 413 에러인 경우 이미지를 더 작게 리사이즈해서 재시도
            if (visionError.status === 413) {
              console.warn('요청 크기 초과 (413), 이미지를 더 작게 리사이즈하여 재시도');
              try {
                // 더 작은 배치로 재시도 (한 번에 1개씩)
                let currentClient = client;
                for (const singleImage of batch) {
                  let singleRetryCount = 0;
                  const maxSingleRetries = 5;
                  
                  while (singleRetryCount < maxSingleRetries) {
                    try {
                      const singleVisionResponse = await currentClient.messages.create({
                        model: MODEL_SNAPSHOT,
                        max_tokens: 1000,
                        messages: [
                          {
                            role: 'user',
                            content: [
                              {
                                type: 'text',
                                text: '이 사진을 분석하여 원고 작성에 활용할 수 있는 키워드와 인상, 분위기를 간단히 정리해주세요. 1-2문장으로 요약해주세요.\n\n⚠️ 매우 중요: 사진에 보이는 숫자(예: 가격, 시간, 번호 등)나 영어 단어/문장은 절대 언급하지 마세요. 숫자나 영어는 정확하지 않을 수 있으므로, 오직 시각적 인상, 분위기, 색감, 공간감, 느낌 등만 묘사해주세요.',
                              },
                              singleImage,
                            ],
                          },
                        ],
                      });
                      
                      const singleVisionText = singleVisionResponse.content[0].type === 'text' ? singleVisionResponse.content[0].text : '';
                      const singleDescriptions = singleVisionText.split('\n').filter((line) => line.trim().length > 0);
                      imageDescriptions.push(...singleDescriptions);
                      break; // 성공했으면 다음 이미지로
                    } catch (singleError: any) {
                      singleRetryCount++;
                      console.error(`개별 이미지 Vision 처리 오류 (시도 ${singleRetryCount}):`, singleError);
                      
                      // 크레딧 부족 또는 인증 에러인 경우 다른 키로 재시도
                      const singleErrorMessage = singleError.message || '';
                      const singleErrorBody = singleError.error || {};
                      const isSingleCreditError = 
                        singleError.status === 400 && 
                        (singleErrorMessage.includes('credit balance is too low') || 
                         singleErrorMessage.includes('credit') ||
                         singleErrorBody.type === 'invalid_request_error' && singleErrorMessage.includes('credit'));
                      
                      if (singleError.status === 401 || singleError.status === 403 || isSingleCreditError) {
                        const singleKey = getClientApiKey(currentClient);
                        if (singleKey) {
                          markKeyAsError(singleKey);
                          console.warn(`개별 이미지 Vision API 키 에러 상태로 표시: ${singleKey.substring(0, 20)}...`);
                        }
                        currentClient = getAnthropicClient(); // 다른 키로 재시도
                      }
                      
                      if (singleRetryCount >= maxSingleRetries) {
                        console.error('개별 이미지 Vision 처리 최대 재시도 초과, 스킵');
                        break; // 다음 이미지로
                      }
                    }
                  }
                }
              } catch (retryError) {
                console.error('재시도 오류:', retryError);
              }
            } else if (visionError.status === 401 || visionError.status === 403) {
              const key = getClientApiKey(client);
              if (key) {
                markKeyAsError(key);
                console.warn(`Vision API 키 에러 상태로 표시 (인증 실패): ${key.substring(0, 20)}...`);
              }
              
              // 다른 키로 재시도
              const newClient = getAnthropicClient();
              try {
                const retryVisionResponse = await newClient.messages.create({
                  model: MODEL_SNAPSHOT,
                  max_tokens: 1000,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: '이 사진들을 분석하여 원고 작성에 활용할 수 있는 키워드와 인상, 분위기를 간단히 정리해주세요. 각 사진에 대해 1-2문장으로 요약해주세요.\n\n🚫🚫🚫 절대 금지 사항 (매우 중요):\n- 사진에 보이는 모든 숫자 (가격, 시간, 번호, 점수, 날짜, 수량 등) 절대 언급 금지\n- 사진에 보이는 모든 영어 단어, 문장, 텍스트 절대 언급 금지\n- 시험지, 문제지, 교재, 학습 자료에 적힌 내용 절대 언급 금지\n- 숫자나 영어는 OCR 오인식이 매우 높으므로 절대 사용하지 마세요\n\n✅ 허용 사항:\n- 오직 시각적 인상, 분위기, 색감, 공간감, 느낌, 분위기만 묘사\n- 예: "밝고 깔끔한 공간", "정돈된 분위기", "편안한 느낌" 등\n- 구체적인 텍스트나 숫자는 절대 포함하지 마세요',
                        },
                        ...batch,
                      ],
                    },
                  ],
                });
                
                const retryVisionText = retryVisionResponse.content[0].type === 'text' ? retryVisionResponse.content[0].text : '';
                const retryBatchDescriptions = retryVisionText.split('\n').filter((line) => line.trim().length > 0);
                imageDescriptions.push(...retryBatchDescriptions);
                continue; // 성공했으면 다음 배치로
              } catch (retryError: any) {
                console.error('Vision 재시도 오류:', retryError);
                // 재시도도 실패하면 스킵
              }
            }
            // 다른 에러는 스킵하고 계속 진행
          }
        }
      }
    }

    // 4. 프롬프트 생성
    const prompt = buildPrompt({
      clientName: client.name,
      placeUrl: client.place_url,
      category: client.category as Category | null,
      guideText,
      keywords: client.keywords,
      contentType,
      lengthHint,
      imageDescriptions,
      humanExtraPrompt,
      stylePreset,
    });

    // 5. 원고 생성 (크레딧 부족 시 다른 키로 자동 전환)
    let anthropicClient = getAnthropicClient();
    let articleContent = '';
    let retryCount = 0;
    const maxRetries = 10; // 모든 키를 시도할 수 있도록 증가

    while (retryCount < maxRetries) {
      try {
        const response = await anthropicClient.messages.create({
          model: MODEL_SNAPSHOT,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        articleContent = response.content[0].type === 'text' ? response.content[0].text : '';
        break;
      } catch (apiError: any) {
        retryCount++;
        console.error(`원고 생성 시도 ${retryCount} 실패:`, apiError);
        
        // 에러 메시지에서 크레딧 부족 확인
        const errorMessage = apiError.message || '';
        const errorBody = apiError.error || {};
        const isCreditError = 
          apiError.status === 400 && 
          (errorMessage.includes('credit balance is too low') || 
           errorMessage.includes('credit') ||
           errorBody.type === 'invalid_request_error' && errorMessage.includes('credit'));
        
        // 401, 403, 또는 크레딧 부족 에러인 경우 해당 키를 에러 상태로 표시
        if (apiError.status === 401 || apiError.status === 403 || isCreditError) {
          const key = getClientApiKey(anthropicClient);
          if (key) {
            markKeyAsError(key);
            console.warn(`API 키 에러 상태로 표시 (크레딧 부족 또는 인증 실패): ${key.substring(0, 20)}...`);
          }
          
          // 다른 키로 재시도하기 위해 새로운 클라이언트 생성
          anthropicClient = getAnthropicClient();
          console.log(`다른 API 키로 재시도 (시도 ${retryCount + 1}/${maxRetries})`);
        }

        if (retryCount >= maxRetries) {
          throw new Error(`원고 생성 실패: 모든 API 키를 시도했지만 실패했습니다. ${apiError.message}`);
        }
        
        // 재시도 전 대기 (크레딧 부족이 아닌 경우에만)
        if (!isCreditError) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    // 6. Article 저장
    const { error: articleError } = await supabaseAdmin.from('articles').insert({
      job_id: jobId,
      client_id: clientId,
      content: articleContent,
      raw_prompt: prompt,
      model_name: MODEL_SNAPSHOT,
    });

    if (articleError) {
      throw new Error(`Article 저장 실패: ${articleError.message}`);
    }

    // 7. Job 상태를 done으로 변경
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (error: any) {
    console.error('작업 처리 오류:', error);
    
    // 에러 상태로 업데이트
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'error',
        error_message: error.message || '알 수 없는 오류',
      })
      .eq('id', jobId);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const includeContent = searchParams.get('include_content') === 'true';

    let query = supabaseAdmin.from('jobs').select('*, clients(name, requires_confirmation)').order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: '조회 실패', details: error }, { status: 500 });
    }

    // 클라이언트 정보를 jobs에 포함
    let jobsWithClient = (data || []).map((job: any) => ({
      ...job,
      client_name: job.clients?.name || null,
      client_requires_confirmation: job.clients?.requires_confirmation || false,
    }));

    // 원고 내용이 필요한 경우 조회
    if (includeContent) {
      const jobIds = jobsWithClient.map((job: any) => job.id);
      const { data: articles, error: articlesError } = await supabaseAdmin
        .from('articles')
        .select('job_id, content')
        .in('job_id', jobIds);

      if (!articlesError && articles) {
        const articlesMap = new Map(articles.map((a: any) => [a.job_id, a.content]));
        jobsWithClient = jobsWithClient.map((job: any) => ({
          ...job,
          article_content: articlesMap.get(job.id) || null,
        }));
      }
    }

    return NextResponse.json({ jobs: jobsWithClient });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

