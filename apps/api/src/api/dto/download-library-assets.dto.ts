import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class DownloadLibraryAssetsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  assetIds!: string[];
}
